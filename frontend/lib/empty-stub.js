// Stub for optional wagmi Tempo wallet dependency (DEV-016)
// wagmi's Connectors.js dynamically imports 'accounts' for Tempo wallet support.
// We don't use Tempo wallet, so this stub satisfies webpack's static analysis.
module.exports = {};
