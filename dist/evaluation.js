const string = { type: 'string' };
export const evaluationSchema = {
    type: 'object', additionalProperties: false,
    required: ['summary', 'changes', 'audit', 'proposedActiveTask'],
    properties: {
        summary: string,
        changes: { type: 'array', items: string },
        audit: {
            type: 'object', additionalProperties: false, required: ['status', 'findings'],
            properties: {
                status: { type: 'string', enum: ['pass', 'warn', 'fail'] },
                findings: {
                    type: 'array', items: {
                        type: 'object', additionalProperties: false,
                        required: ['rule', 'severity', 'explanation', 'evidence'],
                        properties: {
                            rule: string, severity: { type: 'string', enum: ['warning', 'error'] },
                            explanation: string, evidence: string,
                        },
                    },
                },
            },
        },
        proposedActiveTask: string,
    },
};
export function object(value) {
    if (!value || typeof value !== 'object' || Array.isArray(value))
        throw new Error('Invalid model response: expected an object.');
    return value;
}
function keys(value, expected) {
    if (Object.keys(value).length !== expected.length || expected.some(key => !(key in value))) {
        throw new Error('Invalid model response: unexpected or missing fields.');
    }
}
function text(value) {
    if (typeof value !== 'string' || !value.trim() || value.length > 30_000)
        throw new Error('Invalid model response: empty or oversized text.');
    return value;
}
function list(value) {
    if (!Array.isArray(value) || value.length > 100)
        throw new Error('Invalid model response: expected a bounded list.');
    return value;
}
export function validateEvaluation(value) {
    const result = object(value);
    keys(result, ['summary', 'changes', 'audit', 'proposedActiveTask']);
    const audit = object(result.audit);
    keys(audit, ['status', 'findings']);
    if (!['pass', 'warn', 'fail'].includes(String(audit.status)))
        throw new Error('Invalid audit status.');
    const findings = list(audit.findings).map((item) => {
        const finding = object(item);
        keys(finding, ['rule', 'severity', 'explanation', 'evidence']);
        if (finding.severity !== 'warning' && finding.severity !== 'error')
            throw new Error('Invalid finding severity.');
        return { rule: text(finding.rule), severity: finding.severity, explanation: text(finding.explanation), evidence: text(finding.evidence) };
    });
    const expected = findings.some(item => item.severity === 'error') ? 'fail' : findings.length ? 'warn' : 'pass';
    if (audit.status !== expected)
        throw new Error('Invalid model response: audit status contradicts findings.');
    return {
        summary: text(result.summary), changes: list(result.changes).map(text),
        audit: { status: expected, findings }, proposedActiveTask: text(result.proposedActiveTask),
    };
}
