const LEVEL = { critical: 'error', high: 'error', medium: 'warning', low: 'note' };

/** SARIF 2.1.0 for guard findings (GitHub code scanning compatible). */
export function renderSarif(s) {
  const findings = s.guard?.findings || [];
  const ruleIds = [...new Set(findings.map((f) => f.id))];
  return {
    $schema: 'https://raw.githubusercontent.com/oasis-tcs/sarif-spec/main/sarif-2.1/schema/sarif-schema-2.1.json',
    version: '2.1.0',
    runs: [{
      tool: {
        driver: {
          name: 'skilltest-guard',
          version: s.version,
          informationUri: 'https://github.com/archplg/skilltest',
          rules: ruleIds.map((id) => {
            const f = findings.find((x) => x.id === id);
            return { id, name: id, shortDescription: { text: f.message.en }, fullDescription: { text: `${f.message.en} / ${f.message.ru}` }, properties: { category: f.category, severity: f.severity } };
          }),
        },
      },
      results: findings.map((f) => ({
        ruleId: f.id,
        level: LEVEL[f.severity] || 'warning',
        message: { text: `${f.message.en} / ${f.message.ru}` },
        locations: [{ physicalLocation: { artifactLocation: { uri: f.file }, region: { startLine: Math.max(1, f.line || 1), startColumn: f.col || 1, snippet: { text: f.snippet } } } }],
        properties: { severity: f.severity, category: f.category, match: f.match },
      })),
    }],
  };
}
