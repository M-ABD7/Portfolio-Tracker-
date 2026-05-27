export default function WalletsPage() {
  return (
    <main className="p-6 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-2">Wallets</h1>
      <p className="text-sm text-gray-400 mb-8">Connect on-chain wallets to track self-custody holdings</p>

      <div className="rounded-xl border border-dashed border-gray-600 p-12 text-center">
        <div className="text-4xl mb-4">🔗</div>
        <h2 className="text-lg font-semibold mb-2">Wallet integrations coming soon</h2>
        <p className="text-sm text-gray-400 max-w-md mx-auto">
          You will be able to connect on-chain wallets — Ethereum, Solana, Bitcoin, and more —
          to automatically track your DeFi and self-custody holdings alongside your exchange balances.
        </p>
      </div>
    </main>
  );
}
