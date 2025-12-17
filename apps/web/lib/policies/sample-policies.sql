-- Sample Policies for Marketing Pilot AI
-- This file contains example policies you can use as templates

-- 1. Rate Limit: Prevent email spam
INSERT INTO policies (organization_id, type, name, description, rule, severity, active)
VALUES (
  'YOUR_ORG_ID',
  'rate_limit',
  'Email Hourly Limit',
  'Prevent sending more than 50 emails per hour',
  '{
    "limit": 50,
    "window": "hour",
    "scope": "organization",
    "taskTypes": ["email_single", "email_sequence"]
  }',
  'block',
  true
);

-- 2. Banned Phrases: Block spam words
INSERT INTO policies (organization_id, type, name, description, rule, severity, active)
VALUES (
  'YOUR_ORG_ID',
  'banned_phrase',
  'No Spam Words',
  'Block common spam phrases that might trigger filters',
  '{
    "phrases": [
      "100% free",
      "act now",
      "click here",
      "congratulations",
      "earn money",
      "free money",
      "guarantee",
      "limited time",
      "no obligation",
      "risk free",
      "winner"
    ],
    "caseSensitive": false,
    "wholeWord": false,
    "regex": false
  }',
  'block',
  true
);

-- 3. Required Phrases: Email compliance
INSERT INTO policies (organization_id, type, name, description, rule, severity, active)
VALUES (
  'YOUR_ORG_ID',
  'required_phrase',
  'Email Footer Requirements',
  'Ensure all marketing emails include unsubscribe link',
  '{
    "phrases": ["unsubscribe"],
    "atLeastOne": true,
    "caseSensitive": false,
    "location": "footer"
  }',
  'block',
  true
);

-- 4. Claim Lock: Verify product claims
INSERT INTO policies (organization_id, product_id, type, name, description, rule, severity, active)
VALUES (
  'YOUR_ORG_ID',
  'YOUR_PRODUCT_ID',
  'claim_lock',
  'Verified Claims Only',
  'Ensure only verified product claims are used in content',
  '{
    "requireVerified": true,
    "blockedClaims": [
      "cure",
      "miracle",
      "guaranteed results",
      "instant results"
    ]
  }',
  'escalate',
  true
);

-- 5. Domain Allowlist: Restrict external links
INSERT INTO policies (organization_id, type, name, description, rule, severity, active)
VALUES (
  'YOUR_ORG_ID',
  'domain_allowlist',
  'Approved Domains Only',
  'Only allow links to company and partner websites',
  '{
    "allowedDomains": [
      "yourcompany.com",
      "yourblog.com",
      "partner.com"
    ],
    "blockAll": false
  }',
  'warn',
  true
);

-- 6. Time Window: Business hours only
INSERT INTO policies (organization_id, type, name, description, rule, severity, active)
VALUES (
  'YOUR_ORG_ID',
  'time_window',
  'Business Hours Only',
  'Only send emails during business hours',
  '{
    "allowedDays": [1, 2, 3, 4, 5],
    "allowedHours": {
      "start": 9,
      "end": 17
    },
    "timezone": "America/New_York"
  }',
  'block',
  true
);

-- 7. Budget Limit: Daily spending cap
INSERT INTO policies (organization_id, type, name, description, rule, severity, active)
VALUES (
  'YOUR_ORG_ID',
  'budget_limit',
  'Daily Spending Limit',
  'Maximum $500 per day on ad campaigns',
  '{
    "maxSpendCents": 50000,
    "window": "day",
    "scope": "organization"
  }',
  'block',
  true
);

-- 8. Content Rule: Email length requirements
INSERT INTO policies (organization_id, type, name, description, rule, severity, active)
VALUES (
  'YOUR_ORG_ID',
  'content_rule',
  'Email Length Standards',
  'Ensure emails are not too short or too long',
  '{
    "maxLength": 5000,
    "minLength": 100,
    "requiredElements": ["subject", "body"],
    "forbiddenElements": []
  }',
  'warn',
  true
);

-- 9. Required Phrases: Legal disclaimer
INSERT INTO policies (organization_id, product_id, type, name, description, rule, severity, active)
VALUES (
  'YOUR_ORG_ID',
  'YOUR_PRODUCT_ID',
  'required_phrase',
  'Legal Disclaimer Required',
  'Ensure regulated product includes legal disclaimer',
  '{
    "phrases": [
      "results may vary",
      "consult your doctor"
    ],
    "atLeastOne": true,
    "caseSensitive": false,
    "location": "anywhere"
  }',
  'block',
  true
);

-- 10. Banned Phrases: Industry-specific terms (Healthcare example)
INSERT INTO policies (organization_id, product_id, type, name, description, rule, severity, active)
VALUES (
  'YOUR_ORG_ID',
  'YOUR_PRODUCT_ID',
  'banned_phrase',
  'Healthcare Compliance',
  'Block prohibited healthcare claims',
  '{
    "phrases": [
      "cure",
      "treat",
      "prevent disease",
      "FDA approved"
    ],
    "caseSensitive": false,
    "wholeWord": true,
    "regex": false
  }',
  'block',
  true
);

-- 11. Content Rule: Social media character limits
INSERT INTO policies (organization_id, type, name, description, rule, severity, active)
VALUES (
  'YOUR_ORG_ID',
  'content_rule',
  'Twitter Character Limit',
  'Ensure tweets fit within Twitter''s character limit',
  '{
    "maxLength": 280,
    "minLength": 10
  }',
  'block',
  true
);

-- 12. Rate Limit: API call limits
INSERT INTO policies (organization_id, type, name, description, rule, severity, active)
VALUES (
  'YOUR_ORG_ID',
  'rate_limit',
  'Connector Rate Limit',
  'Respect third-party API rate limits',
  '{
    "limit": 100,
    "window": "hour",
    "scope": "connector"
  }',
  'block',
  true
);

-- 13. Budget Limit: Campaign budget
INSERT INTO policies (organization_id, type, name, description, rule, severity, active)
VALUES (
  'YOUR_ORG_ID',
  'budget_limit',
  'Campaign Budget Cap',
  'Do not exceed campaign budget',
  '{
    "maxSpendCents": 100000,
    "window": "campaign",
    "scope": "campaign"
  }',
  'block',
  true
);

-- 14. Banned Phrases: Brand protection (competitor mentions)
INSERT INTO policies (organization_id, type, name, description, rule, severity, active)
VALUES (
  'YOUR_ORG_ID',
  'banned_phrase',
  'No Competitor Mentions',
  'Avoid mentioning competitor names',
  '{
    "phrases": [
      "CompetitorA",
      "CompetitorB",
      "CompetitorC"
    ],
    "caseSensitive": false,
    "wholeWord": true,
    "regex": false
  }',
  'warn',
  true
);

-- 15. Required Phrases: Brand consistency
INSERT INTO policies (organization_id, type, name, description, rule, severity, active)
VALUES (
  'YOUR_ORG_ID',
  'required_phrase',
  'Brand Tagline',
  'Include company tagline in major content pieces',
  '{
    "phrases": ["Your Trusted Partner"],
    "atLeastOne": true,
    "caseSensitive": false,
    "location": "anywhere"
  }',
  'warn',
  true
);

-- Note: Replace 'YOUR_ORG_ID' and 'YOUR_PRODUCT_ID' with actual UUIDs from your database
-- You can also adjust rules, severity levels, and active status as needed

-- To apply these policies, either:
-- 1. Run this SQL file directly: psql -f sample-policies.sql
-- 2. Copy specific INSERT statements into your migration
-- 3. Use the Supabase dashboard to insert policies manually
-- 4. Create an API endpoint to insert policies programmatically
