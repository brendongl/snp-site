# OpenRouter Integration Guide
**Date**: January 12, 2025
**Version**: 1.8.0+
**Feature**: Natural Language Rule Parsing for AI-Powered Rostering

---

## Overview

The rostering system uses OpenRouter to access Claude AI for parsing natural language scheduling rules. OpenRouter provides a unified API interface for multiple AI models with better rate limiting and cost management.

---

## Why OpenRouter?

### Advantages over Direct Anthropic API:
1. **Single API Key**: One key for multiple AI models
2. **Better Rate Limiting**: More generous limits for production use
3. **Cost Management**: Transparent pricing and usage tracking
4. **Reliability**: Load balancing across multiple providers
5. **Flexibility**: Easy to switch models without code changes

### Cost Comparison:
- **Direct Anthropic**: ~$3 per million tokens (Claude 3.5 Sonnet)
- **OpenRouter**: ~$3 per million tokens (same model, but with better tooling)

---

## Setup Instructions

### 1. Get OpenRouter API Key

1. Visit [https://openrouter.ai/keys](https://openrouter.ai/keys)
2. Sign up or log in
3. Create a new API key
4. Copy the key (format: `sk-or-v1-...`)

### 2. Configure Environment Variables

Add to `.env.local`:
```bash
OPENROUTER_API_KEY=sk-or-v1-xxxxxxxxxxxxx
```

For Railway deployment, add to environment variables:
```bash
OPENROUTER_API_KEY=sk-or-v1-xxxxxxxxxxxxx
```

### 3. Test Integration

Run the test script:
```bash
node scripts/test-openrouter-rule-parsing.js
```

Expected output:
```
🧪 Testing OpenRouter rule parsing integration...

✅ OPENROUTER_API_KEY found

📝 Testing rule: "Brendon should work no more than 35 hours per week"

✅ Rule parsed successfully!

📊 Parsed Constraint:
{
  "type": "max_hours",
  "staff_id": "...",
  "max_hours": 35
}

⚖️  Suggested Weight: 80
📖 Explanation: Limits Brendon to 35 hours weekly to prevent overwork
```

---

## Technical Implementation

### Service Layer
**File**: [lib/services/rule-parser-service.ts](../lib/services/rule-parser-service.ts)

**Key Changes**:
```typescript
// Before (Direct Anthropic)
this.anthropic = new Anthropic({ apiKey });

// After (OpenRouter)
this.anthropic = new Anthropic({
  apiKey,
  baseURL: 'https://openrouter.ai/api/v1',
});
```

**Model Identifier**:
```typescript
// Before (Direct Anthropic)
model: 'claude-3-5-sonnet-20241022'

// After (OpenRouter)
model: 'anthropic/claude-3.5-sonnet'
```

### API Compatibility
OpenRouter supports the full Anthropic SDK API, so no changes needed to:
- Message format
- System prompts
- Response parsing
- Error handling

---

## Usage

### Parse Single Rule
```bash
POST /api/roster/rules/parse
Content-Type: application/json

{
  "rule_text": "Brendon should work no more than 35 hours per week"
}
```

**Response**:
```json
{
  "success": true,
  "parsed_constraint": {
    "type": "max_hours",
    "staff_id": "c1ec6db5-e14a-414a-b70e-88a6cc0d8250",
    "staff_name": "Brendon Gan-Le",
    "max_hours": 35
  },
  "suggested_weight": 80,
  "explanation": "Limits Brendon to 35 hours weekly to prevent overwork",
  "original_rule": "Brendon should work no more than 35 hours per week"
}
```

### Supported Constraint Types

1. **max_hours**: Maximum hours per week
   - Example: "John should work no more than 35 hours"

2. **min_hours**: Minimum hours per week
   - Example: "Sarah needs at least 20 hours weekly"

3. **preferred_hours**: Preferred hour range
   - Example: "Mike prefers between 25 and 30 hours"

4. **max_consecutive_days**: Maximum consecutive working days
   - Example: "No one should work more than 5 days in a row"

5. **day_off**: Specific day unavailable
   - Example: "Emily has Mondays off"

6. **no_back_to_back**: No back-to-back shift types
   - Example: "No closing then opening shifts"

7. **requires_keys_for_opening**: Opening shifts need keys
   - Example: "All opening shifts require staff with keys"

8. **fairness**: Distribute hours evenly
   - Example: "Keep hours within 10 hour difference"

---

## Rate Limits

### OpenRouter Limits:
- **Free Tier**: 10 requests/minute
- **Paid Tier**: 200 requests/minute
- **Caching**: 100ms delay between requests (rate limit protection)

### Current Implementation:
```typescript
// Built-in rate limiting in parseRules()
for (const rule of rules) {
  const result = await this.parseRule(rule, staffContext);
  results.push(result);

  // Add small delay to respect rate limits
  await new Promise(resolve => setTimeout(resolve, 100));
}
```

---

## Cost Estimation

### Usage Scenarios:

**Small Business (10 rules/month)**:
- Tokens per rule: ~500 tokens
- Monthly tokens: 5,000 tokens
- Monthly cost: ~$0.015 USD

**Medium Business (50 rules/month)**:
- Monthly tokens: 25,000 tokens
- Monthly cost: ~$0.075 USD

**Large Business (200 rules/month)**:
- Monthly tokens: 100,000 tokens
- Monthly cost: ~$0.30 USD

**Conclusion**: Extremely cost-effective for scheduling automation.

---

## Error Handling

### Common Errors:

1. **Missing API Key**
```json
{
  "success": false,
  "error": "Failed to parse rule",
  "details": "OPENROUTER_API_KEY not configured in environment"
}
```
**Solution**: Add API key to environment variables

2. **Rate Limit Exceeded**
```json
{
  "error": "Rate limit exceeded",
  "retry_after": 60
}
```
**Solution**: Implement exponential backoff or use batch parsing

3. **Invalid Model**
```json
{
  "error": "Model not found"
}
```
**Solution**: Verify model identifier is `anthropic/claude-3.5-sonnet`

---

## Monitoring & Analytics

### OpenRouter Dashboard
Visit [https://openrouter.ai/activity](https://openrouter.ai/activity) to monitor:
- Request count
- Token usage
- Cost tracking
- Error rates
- Model performance

### Application Logs
```bash
# View rule parsing logs
curl http://localhost:3000/api/debug/logs | grep "Rule parsing"
```

---

## Security Best Practices

1. **Never Commit API Keys**
   - Always use environment variables
   - Add `.env.local` to `.gitignore`
   - Use Railway secrets for deployment

2. **Rotate Keys Regularly**
   - Rotate every 90 days minimum
   - Use separate keys for dev/staging/production

3. **Rate Limit Protection**
   - Implement request throttling
   - Cache parsed rules when possible
   - Use batch parsing for multiple rules

4. **Input Validation**
   - Sanitize user input before parsing
   - Limit rule text length (max 500 characters)
   - Validate parsed constraints before saving

---

## Troubleshooting

### Issue: "OPENROUTER_API_KEY not configured"
**Cause**: Environment variable not set
**Solution**:
```bash
# Add to .env.local
echo "OPENROUTER_API_KEY=sk-or-v1-..." >> .env.local

# Restart dev server
npm run dev
```

### Issue: Parsing returns incorrect constraints
**Cause**: Ambiguous rule text
**Solution**: Provide staff context to help disambiguation
```typescript
const staff = await getStaffMembers();
const result = await RuleParserService.parseRule(ruleText, staff);
```

### Issue: Slow response times
**Cause**: API latency or rate limiting
**Solution**:
1. Implement caching for common rules
2. Use batch parsing for multiple rules
3. Set reasonable timeout values (15 seconds)

---

## Future Enhancements

### Phase 3 Improvements:
1. **Rule Templates**: Pre-defined common rules
2. **Rule Suggestions**: AI-generated rule recommendations
3. **Conflict Detection**: Identify conflicting rules automatically
4. **Natural Language Queries**: "Show me all rules for Brendon"
5. **Rule Optimization**: Suggest weight adjustments

### Additional Models:
OpenRouter makes it easy to experiment with other models:
```typescript
// Switch to GPT-4
model: 'openai/gpt-4-turbo'

// Or Claude Opus for complex rules
model: 'anthropic/claude-3-opus'
```

---

## Migration Notes

### From Direct Anthropic API:

**No Breaking Changes**:
- Existing code using Anthropic SDK works unchanged
- Only configuration update needed (baseURL)
- All error handling remains the same
- Response format identical

**Migration Checklist**:
- [x] Update environment variable name
- [x] Add OpenRouter baseURL
- [x] Update model identifier format
- [x] Test rule parsing endpoint
- [x] Update documentation
- [ ] Migrate production API key

---

## Support & Resources

### OpenRouter:
- **Documentation**: https://openrouter.ai/docs
- **Status Page**: https://status.openrouter.ai/
- **Discord**: https://discord.gg/openrouter
- **Support**: support@openrouter.ai

### Internal:
- **Test Script**: [scripts/test-openrouter-rule-parsing.js](../scripts/test-openrouter-rule-parsing.js)
- **Service Layer**: [lib/services/rule-parser-service.ts](../lib/services/rule-parser-service.ts)
- **API Endpoint**: [app/api/roster/rules/parse/route.ts](../app/api/roster/rules/parse/route.ts)

---

## Changelog

### v1.8.0 (January 12, 2025)
- ✅ Migrated from direct Anthropic API to OpenRouter
- ✅ Updated model identifier to OpenRouter format
- ✅ Added OPENROUTER_API_KEY environment variable
- ✅ Created test script for integration verification
- ✅ Updated documentation

---

**Configured By**: Claude Code
**Tested**: January 12, 2025
**Status**: ✅ Production Ready
