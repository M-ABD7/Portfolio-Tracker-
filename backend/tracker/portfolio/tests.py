import io

from django.contrib.auth.models import User
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import TestCase
from rest_framework.authtoken.models import Token

from .csv_import import compute_fifo, parse_binance_csv
from .models import Holding, Transaction

# Real Binance "Account Statement" export rows. One Buy trade is 3 rows
# sharing one UTC_Time: Transaction Fee (base coin), Transaction Buy (base
# coin, +), Transaction Spend (quote coin, -). One Sell trade is
# Transaction Fee (quote coin), Transaction Sold (base coin, -),
# Transaction Revenue (quote coin, +). Note the two legs of one trade use
# *different* Operation labels. Blank fields between UTC_Time/Account and
# Operation/Coin mirror the real export's column layout; parsing is by
# column name, so these unnamed columns are simply ignored.
#
# Also covers: a USDT-paired Binance Convert (buy of ADA, in the alternate
# M/D/Y date format), a coin-to-coin Convert (INJ/DOT, no USD cost basis —
# skipped), a Transfer row and a Launchpool row (both non-trade — skipped).
SAMPLE_CSV = """User_ID,UTC_Time,,Account,Operation,,Coin,Change,Remark
111154648,2024-02-19 15:32:33,,Spot,Transaction Fee,,SOL,-0.00009,
111154648,2024-02-19 15:32:33,,Spot,Transaction Buy,,SOL,0.09,
111154648,2024-02-19 15:32:33,,Spot,Transaction Spend,,USDT,-10.0161,
111154648,2024-02-19 15:43:08,,Spot,Transaction Fee,,USDT,-0.0089384,
111154648,2024-02-19 15:43:08,,Spot,Transaction Sold,,SOL,-0.08,
111154648,2024-02-19 15:43:08,,Spot,Transaction Revenue,,USDT,8.9384,
111154648,2/21/2024 10:00:00,,Spot,Binance Convert,,USDT,-50,
111154648,2/21/2024 10:00:00,,Spot,Binance Convert,,ADA,100,
111154648,2024-02-22 11:00:00,,Spot,Binance Convert,,INJ,-1,
111154648,2024-02-22 11:00:00,,Spot,Binance Convert,,DOT,2,
111154648,2024-02-23 12:00:00,,Spot,Transfer Between Spot and Funding,,USDT,-10,
111154648,2024-02-24 13:00:00,,Spot,Launchpool Subscription/Redemption,,BNB,-5,
"""


class ParseBinanceCsvTests(TestCase):
    def test_reconstructs_trades_and_skips_non_trade_operations(self):
        trades, skipped = parse_binance_csv(io.StringIO(SAMPLE_CSV))
        self.assertEqual(len(trades), 3)
        self.assertEqual(len(skipped), 4)

        reasons = [entry["reason"] for entry in skipped]
        self.assertEqual(sum("Crypto-to-crypto convert not supported" in r for r in reasons), 2)
        self.assertEqual(sum("Non-trade operation" in r for r in reasons), 2)

    def test_convert_buy_reconstructed_correctly(self):
        trades, _ = parse_binance_csv(io.StringIO(SAMPLE_CSV))
        ada_trade = next(t for t in trades if t.base_asset == "ADA")
        self.assertEqual(ada_trade.side, "buy")
        self.assertAlmostEqual(ada_trade.quantity, 100, places=6)
        self.assertAlmostEqual(ada_trade.notional, 50, places=6)
        self.assertAlmostEqual(ada_trade.price, 0.5, places=6)
        self.assertEqual(ada_trade.fee_amount, 0.0)

    def test_accepts_real_export_header_spelling(self):
        # The real Binance export uses "User ID"/"Time" rather than the
        # "User_ID"/"UTC_Time" spelling used elsewhere in this file's
        # fixtures — headers must be matched case/space-insensitively.
        real_header_csv = """User ID,Time,Account,Operation,Coin,Change,Remark
111154648,2024-02-19 15:32:33,Spot,Transaction Fee,SOL,-0.00009,
111154648,2024-02-19 15:32:33,Spot,Transaction Buy,SOL,0.09,
111154648,2024-02-19 15:32:33,Spot,Transaction Spend,USDT,-10.0161,
"""
        trades, skipped = parse_binance_csv(io.StringIO(real_header_csv))
        self.assertEqual(skipped, [])
        self.assertEqual(len(trades), 1)
        self.assertEqual(trades[0].base_asset, "SOL")
        self.assertEqual(trades[0].side, "buy")


class ComputeFifoTests(TestCase):
    def test_fifo_matching_realized_pnl_and_remaining_lot(self):
        trades, _ = parse_binance_csv(io.StringIO(SAMPLE_CSV))
        results = compute_fifo(trades)
        sol = results["SOL"]

        # Buy: fee (0.00009 SOL) is paid in the base coin, so it reduces
        # the quantity actually received: 0.09 - 0.00009 = 0.08991 SOL,
        # for 10.0161 USDT spent -> lot cost = 10.0161 / 0.08991.
        buy_quantity = 0.09 - 0.00009
        buy_cost = 10.0161 / buy_quantity

        # Sell: 0.08 SOL for 8.9384 USDT (price = 111.73), fee 0.0089384
        # USDT is in the quote coin, so it reduces proceeds per unit.
        sell_quantity = 0.08
        sell_price = 8.9384 / sell_quantity
        fee_per_unit = 0.0089384 / sell_quantity

        expected_realized_pnl = sell_quantity * (sell_price - fee_per_unit - buy_cost)
        expected_remaining_qty = buy_quantity - sell_quantity

        self.assertAlmostEqual(sol.total_realized_pnl, expected_realized_pnl, places=6)
        self.assertAlmostEqual(sol.remaining_quantity, expected_remaining_qty, places=6)
        self.assertAlmostEqual(sol.avg_cost_basis, buy_cost, places=6)

        # Convert-derived buy: 50 USDT -> 100 ADA, no fee row for Converts.
        ada = results["ADA"]
        self.assertAlmostEqual(ada.remaining_quantity, 100, places=6)
        self.assertAlmostEqual(ada.avg_cost_basis, 0.5, places=6)
        self.assertAlmostEqual(ada.total_realized_pnl, 0.0, places=6)


class ImportBinanceCsvViewTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(username="csv_test_user", password="pw")
        self.token = Token.objects.create(user=self.user)
        self.auth_header = {"HTTP_AUTHORIZATION": f"Token {self.token.key}"}

    def test_import_creates_holding_and_realized_pnl_transaction(self):
        upload = SimpleUploadedFile("trades.csv", SAMPLE_CSV.encode("utf-8"), content_type="text/csv")
        response = self.client.post(
            "/api/portfolio/import/csv/",
            {"file": upload},
            **self.auth_header,
        )

        buy_quantity = 0.09 - 0.00009
        buy_cost = 10.0161 / buy_quantity
        sell_price = 8.9384 / 0.08
        fee_per_unit = 0.0089384 / 0.08
        expected_realized_pnl = 0.08 * (sell_price - fee_per_unit - buy_cost)
        expected_remaining_qty = buy_quantity - 0.08

        self.assertEqual(response.status_code, 201, response.content)
        payload = response.json()
        assets_by_symbol = {asset["symbol"]: asset for asset in payload["assets"]}
        self.assertEqual(set(assets_by_symbol.keys()), {"SOL", "ADA"})
        self.assertAlmostEqual(assets_by_symbol["SOL"]["quantity"], expected_remaining_qty, places=6)
        self.assertAlmostEqual(assets_by_symbol["ADA"]["quantity"], 100, places=6)
        self.assertAlmostEqual(assets_by_symbol["ADA"]["avgBuyPrice"], 0.5, places=6)
        self.assertAlmostEqual(payload["realizedPnl"], expected_realized_pnl, places=6)
        self.assertEqual(len(payload["skippedRows"]), 4)

        holding = Holding.objects.get(asset__symbol="SOL")
        self.assertAlmostEqual(holding.quantity, expected_remaining_qty, places=6)
        self.assertAlmostEqual(holding.cost_basis, buy_cost, places=6)

        sell_tx = Transaction.objects.get(asset__symbol="SOL", transaction_type="sell")
        self.assertAlmostEqual(sell_tx.metadata["realized_pnl"], expected_realized_pnl, places=6)

    def test_missing_file_returns_400(self):
        response = self.client.post("/api/portfolio/import/csv/", {}, **self.auth_header)
        self.assertEqual(response.status_code, 400)

    def test_malformed_csv_returns_400(self):
        upload = SimpleUploadedFile("trades.csv", b"not,a,binance,export\n1,2,3,4", content_type="text/csv")
        response = self.client.post(
            "/api/portfolio/import/csv/",
            {"file": upload},
            **self.auth_header,
        )
        self.assertEqual(response.status_code, 400)
