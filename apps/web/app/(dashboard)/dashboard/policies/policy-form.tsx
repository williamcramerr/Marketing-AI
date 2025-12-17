'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Loader2, ArrowLeft, Plus, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { createPolicy, updatePolicy, type PolicyFormData } from '@/lib/actions/policies';
import { getPolicyTypeDisplayName } from '@/lib/utils/policy-utils';
import { useToast } from '@/hooks/use-toast';
import type { PolicyType, PolicySeverity, PolicyRule } from '@/lib/policies/types';

interface PolicyFormProps {
  policy?: {
    id: string;
    name: string;
    description: string | null;
    type: string;
    severity: string;
    rule: unknown;
    product_id: string | null;
    active: boolean;
  };
  products?: { id: string; name: string }[];
}

const POLICY_TYPES: PolicyType[] = [
  'rate_limit',
  'banned_phrase',
  'required_phrase',
  'claim_lock',
  'domain_allowlist',
  'suppression',
  'time_window',
  'budget_limit',
  'content_rule',
];

const SEVERITY_OPTIONS: { value: PolicySeverity; label: string; description: string }[] = [
  { value: 'warn', label: 'Warning', description: 'Log and notify but allow execution' },
  { value: 'block', label: 'Block', description: 'Prevent execution entirely' },
  { value: 'escalate', label: 'Escalate', description: 'Require human approval' },
];

function getDefaultRule(type: PolicyType): PolicyRule {
  switch (type) {
    case 'rate_limit':
      return { limit: 100, window: 'day', scope: 'organization' };
    case 'banned_phrase':
      return { phrases: [], caseSensitive: false, wholeWord: false };
    case 'required_phrase':
      return { phrases: [], atLeastOne: true, caseSensitive: false, location: 'anywhere' };
    case 'claim_lock':
      return { requireVerified: true, allowedClaims: [], blockedClaims: [] };
    case 'domain_allowlist':
      return { allowedDomains: [], blockAll: false };
    case 'suppression':
      return { checkGlobalList: true, checkProductList: true };
    case 'time_window':
      return { allowedDays: [1, 2, 3, 4, 5], allowedHours: { start: 9, end: 17 }, timezone: 'America/New_York' };
    case 'budget_limit':
      return { maxSpendCents: 10000, window: 'month', scope: 'campaign' };
    case 'content_rule':
      return { maxLength: 280, minLength: 0 };
    default:
      return {};
  }
}

export function PolicyForm({ policy, products = [] }: PolicyFormProps) {
  const isEditing = !!policy;
  const router = useRouter();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [formData, setFormData] = useState<{
    name: string;
    description: string;
    type: PolicyType;
    severity: PolicySeverity;
    productId: string;
    active: boolean;
  }>({
    name: policy?.name || '',
    description: policy?.description || '',
    type: (policy?.type as PolicyType) || 'banned_phrase',
    severity: (policy?.severity as PolicySeverity) || 'warn',
    productId: policy?.product_id || '',
    active: policy?.active ?? true,
  });

  const [rule, setRule] = useState<PolicyRule>(
    (policy?.rule as PolicyRule) || getDefaultRule(formData.type)
  );

  function handleTypeChange(newType: PolicyType) {
    setFormData((prev) => ({ ...prev, type: newType }));
    setRule(getDefaultRule(newType));
  }

  function updateRule<K extends keyof PolicyRule>(key: K, value: PolicyRule[K]) {
    setRule((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setIsSubmitting(true);

    const submitData: PolicyFormData = {
      name: formData.name,
      description: formData.description || undefined,
      type: formData.type,
      severity: formData.severity,
      rule: rule,
      productId: formData.productId || undefined,
      active: formData.active,
    };

    const result = isEditing
      ? await updatePolicy(policy.id, submitData)
      : await createPolicy(submitData);

    if (result.success) {
      toast({
        title: isEditing ? 'Policy updated' : 'Policy created',
        description: `${formData.name} has been ${isEditing ? 'updated' : 'created'} successfully.`,
      });
      router.push('/dashboard/policies');
      router.refresh();
    } else {
      toast({
        title: 'Error',
        description: result.error || `Failed to ${isEditing ? 'update' : 'create'} policy`,
        variant: 'destructive',
      });
    }

    setIsSubmitting(false);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      {/* Basic Information */}
      <div className="space-y-4">
        <h3 className="text-lg font-medium">Basic Information</h3>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="name">
              Policy Name <span className="text-destructive">*</span>
            </Label>
            <Input
              id="name"
              type="text"
              value={formData.name}
              onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
              placeholder="e.g., No Competitor Mentions"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="productId">Scope</Label>
            <Select
              value={formData.productId}
              onValueChange={(value) => setFormData((prev) => ({ ...prev, productId: value }))}
            >
              <SelectTrigger>
                <SelectValue placeholder="Organization-wide" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="_none_">Organization-wide</SelectItem>
                {products.map((product) => (
                  <SelectItem key={product.id} value={product.id}>
                    {product.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Apply to a specific product or the entire organization
            </p>
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="description">Description</Label>
          <textarea
            id="description"
            value={formData.description}
            onChange={(e) => setFormData((prev) => ({ ...prev, description: e.target.value }))}
            placeholder="Describe what this policy does..."
            rows={2}
            className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-base ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm"
          />
        </div>
      </div>

      {/* Policy Type and Severity */}
      <div className="space-y-4">
        <h3 className="text-lg font-medium">Policy Configuration</h3>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="type">
              Policy Type <span className="text-destructive">*</span>
            </Label>
            <Select
              value={formData.type}
              onValueChange={(value) => handleTypeChange(value as PolicyType)}
              disabled={isEditing}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {POLICY_TYPES.map((type) => (
                  <SelectItem key={type} value={type}>
                    {getPolicyTypeDisplayName(type)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {isEditing && (
              <p className="text-xs text-muted-foreground">
                Policy type cannot be changed after creation
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="severity">
              Severity <span className="text-destructive">*</span>
            </Label>
            <Select
              value={formData.severity}
              onValueChange={(value) => setFormData((prev) => ({ ...prev, severity: value as PolicySeverity }))}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SEVERITY_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    <div>
                      <div className="font-medium">{option.label}</div>
                      <div className="text-xs text-muted-foreground">{option.description}</div>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* Dynamic Rule Configuration */}
      <div className="space-y-4">
        <h3 className="text-lg font-medium">Rule Configuration</h3>
        <RuleConfiguration type={formData.type} rule={rule} updateRule={updateRule} />
      </div>

      {/* Active Status */}
      <div className="flex items-center space-x-2">
        <input
          id="active"
          type="checkbox"
          checked={formData.active}
          onChange={(e) => setFormData((prev) => ({ ...prev, active: e.target.checked }))}
          className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
        />
        <Label htmlFor="active" className="cursor-pointer font-normal">
          Active
        </Label>
        <p className="text-xs text-muted-foreground">
          (Inactive policies won't be enforced)
        </p>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-4 border-t pt-6">
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {isEditing ? 'Update Policy' : 'Create Policy'}
        </Button>
        <Link href="/dashboard/policies">
          <Button type="button" variant="outline">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Cancel
          </Button>
        </Link>
      </div>
    </form>
  );
}

// Dynamic Rule Configuration Component
function RuleConfiguration({
  type,
  rule,
  updateRule,
}: {
  type: PolicyType;
  rule: PolicyRule;
  updateRule: <K extends keyof PolicyRule>(key: K, value: PolicyRule[K]) => void;
}) {
  switch (type) {
    case 'rate_limit':
      return <RateLimitConfig rule={rule as any} updateRule={updateRule} />;
    case 'banned_phrase':
      return <BannedPhraseConfig rule={rule as any} updateRule={updateRule} />;
    case 'required_phrase':
      return <RequiredPhraseConfig rule={rule as any} updateRule={updateRule} />;
    case 'claim_lock':
      return <ClaimLockConfig rule={rule as any} updateRule={updateRule} />;
    case 'domain_allowlist':
      return <DomainAllowlistConfig rule={rule as any} updateRule={updateRule} />;
    case 'suppression':
      return <SuppressionConfig rule={rule as any} updateRule={updateRule} />;
    case 'time_window':
      return <TimeWindowConfig rule={rule as any} updateRule={updateRule} />;
    case 'budget_limit':
      return <BudgetLimitConfig rule={rule as any} updateRule={updateRule} />;
    case 'content_rule':
      return <ContentRuleConfig rule={rule as any} updateRule={updateRule} />;
    default:
      return <p className="text-muted-foreground">Unknown policy type</p>;
  }
}

// Rate Limit Configuration
function RateLimitConfig({ rule, updateRule }: { rule: any; updateRule: any }) {
  return (
    <div className="grid gap-4 md:grid-cols-3">
      <div className="space-y-2">
        <Label>Limit</Label>
        <Input
          type="number"
          value={rule.limit || 100}
          onChange={(e) => updateRule('limit', parseInt(e.target.value) || 0)}
          min={1}
        />
        <p className="text-xs text-muted-foreground">Maximum executions allowed</p>
      </div>
      <div className="space-y-2">
        <Label>Time Window</Label>
        <Select
          value={rule.window || 'day'}
          onValueChange={(value) => updateRule('window', value)}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="hour">Per Hour</SelectItem>
            <SelectItem value="day">Per Day</SelectItem>
            <SelectItem value="week">Per Week</SelectItem>
            <SelectItem value="month">Per Month</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-2">
        <Label>Scope</Label>
        <Select
          value={rule.scope || 'organization'}
          onValueChange={(value) => updateRule('scope', value)}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="connector">Per Connector</SelectItem>
            <SelectItem value="campaign">Per Campaign</SelectItem>
            <SelectItem value="product">Per Product</SelectItem>
            <SelectItem value="organization">Organization</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}

// Banned Phrase Configuration
function BannedPhraseConfig({ rule, updateRule }: { rule: any; updateRule: any }) {
  const [newPhrase, setNewPhrase] = useState('');
  const phrases = rule.phrases || [];

  function addPhrase() {
    if (newPhrase.trim() && !phrases.includes(newPhrase.trim())) {
      updateRule('phrases', [...phrases, newPhrase.trim()]);
      setNewPhrase('');
    }
  }

  function removePhrase(phrase: string) {
    updateRule('phrases', phrases.filter((p: string) => p !== phrase));
  }

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label>Banned Phrases</Label>
        <div className="flex gap-2">
          <Input
            value={newPhrase}
            onChange={(e) => setNewPhrase(e.target.value)}
            placeholder="Enter a phrase to ban..."
            onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addPhrase())}
          />
          <Button type="button" onClick={addPhrase} variant="secondary">
            <Plus className="h-4 w-4" />
          </Button>
        </div>
        {phrases.length > 0 && (
          <div className="flex flex-wrap gap-2 pt-2">
            {phrases.map((phrase: string) => (
              <span
                key={phrase}
                className="inline-flex items-center gap-1 rounded-full bg-destructive/10 px-3 py-1 text-sm text-destructive"
              >
                {phrase}
                <button type="button" onClick={() => removePhrase(phrase)}>
                  <X className="h-3 w-3" />
                </button>
              </span>
            ))}
          </div>
        )}
      </div>
      <div className="flex gap-4">
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={rule.caseSensitive || false}
            onChange={(e) => updateRule('caseSensitive', e.target.checked)}
            className="h-4 w-4 rounded"
          />
          <span className="text-sm">Case sensitive</span>
        </label>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={rule.wholeWord || false}
            onChange={(e) => updateRule('wholeWord', e.target.checked)}
            className="h-4 w-4 rounded"
          />
          <span className="text-sm">Whole word only</span>
        </label>
      </div>
    </div>
  );
}

// Required Phrase Configuration
function RequiredPhraseConfig({ rule, updateRule }: { rule: any; updateRule: any }) {
  const [newPhrase, setNewPhrase] = useState('');
  const phrases = rule.phrases || [];

  function addPhrase() {
    if (newPhrase.trim() && !phrases.includes(newPhrase.trim())) {
      updateRule('phrases', [...phrases, newPhrase.trim()]);
      setNewPhrase('');
    }
  }

  function removePhrase(phrase: string) {
    updateRule('phrases', phrases.filter((p: string) => p !== phrase));
  }

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label>Required Phrases</Label>
        <div className="flex gap-2">
          <Input
            value={newPhrase}
            onChange={(e) => setNewPhrase(e.target.value)}
            placeholder="Enter a required phrase..."
            onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addPhrase())}
          />
          <Button type="button" onClick={addPhrase} variant="secondary">
            <Plus className="h-4 w-4" />
          </Button>
        </div>
        {phrases.length > 0 && (
          <div className="flex flex-wrap gap-2 pt-2">
            {phrases.map((phrase: string) => (
              <span
                key={phrase}
                className="inline-flex items-center gap-1 rounded-full bg-green-100 px-3 py-1 text-sm text-green-800"
              >
                {phrase}
                <button type="button" onClick={() => removePhrase(phrase)}>
                  <X className="h-3 w-3" />
                </button>
              </span>
            ))}
          </div>
        )}
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={rule.atLeastOne ?? true}
            onChange={(e) => updateRule('atLeastOne', e.target.checked)}
            className="h-4 w-4 rounded"
          />
          <span className="text-sm">Require at least one (otherwise all required)</span>
        </label>
        <div className="space-y-2">
          <Label>Location</Label>
          <Select
            value={rule.location || 'anywhere'}
            onValueChange={(value) => updateRule('location', value)}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="anywhere">Anywhere</SelectItem>
              <SelectItem value="header">Header only</SelectItem>
              <SelectItem value="footer">Footer only</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
    </div>
  );
}

// Claim Lock Configuration
function ClaimLockConfig({ rule, updateRule }: { rule: any; updateRule: any }) {
  return (
    <div className="space-y-4">
      <label className="flex items-center gap-2">
        <input
          type="checkbox"
          checked={rule.requireVerified ?? true}
          onChange={(e) => updateRule('requireVerified', e.target.checked)}
          className="h-4 w-4 rounded"
        />
        <span className="text-sm">Require verified claims only</span>
      </label>
      <p className="text-sm text-muted-foreground">
        When enabled, only claims that have been verified in your knowledge base can be used in content.
        Unverified statistical claims, testimonials, or performance metrics will be flagged.
      </p>
    </div>
  );
}

// Domain Allowlist Configuration
function DomainAllowlistConfig({ rule, updateRule }: { rule: any; updateRule: any }) {
  const [newDomain, setNewDomain] = useState('');
  const domains = rule.allowedDomains || [];

  function addDomain() {
    if (newDomain.trim() && !domains.includes(newDomain.trim())) {
      updateRule('allowedDomains', [...domains, newDomain.trim()]);
      setNewDomain('');
    }
  }

  function removeDomain(domain: string) {
    updateRule('allowedDomains', domains.filter((d: string) => d !== domain));
  }

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label>Allowed Domains</Label>
        <div className="flex gap-2">
          <Input
            value={newDomain}
            onChange={(e) => setNewDomain(e.target.value)}
            placeholder="e.g., example.com"
            onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addDomain())}
          />
          <Button type="button" onClick={addDomain} variant="secondary">
            <Plus className="h-4 w-4" />
          </Button>
        </div>
        {domains.length > 0 && (
          <div className="flex flex-wrap gap-2 pt-2">
            {domains.map((domain: string) => (
              <span
                key={domain}
                className="inline-flex items-center gap-1 rounded-full bg-blue-100 px-3 py-1 text-sm text-blue-800"
              >
                {domain}
                <button type="button" onClick={() => removeDomain(domain)}>
                  <X className="h-3 w-3" />
                </button>
              </span>
            ))}
          </div>
        )}
      </div>
      <label className="flex items-center gap-2">
        <input
          type="checkbox"
          checked={rule.blockAll || false}
          onChange={(e) => updateRule('blockAll', e.target.checked)}
          className="h-4 w-4 rounded"
        />
        <span className="text-sm">Block all external links (only allow listed domains)</span>
      </label>
    </div>
  );
}

// Suppression Configuration
function SuppressionConfig({ rule, updateRule }: { rule: any; updateRule: any }) {
  return (
    <div className="space-y-4">
      <label className="flex items-center gap-2">
        <input
          type="checkbox"
          checked={rule.checkGlobalList ?? true}
          onChange={(e) => updateRule('checkGlobalList', e.target.checked)}
          className="h-4 w-4 rounded"
        />
        <span className="text-sm">Check global suppression list</span>
      </label>
      <label className="flex items-center gap-2">
        <input
          type="checkbox"
          checked={rule.checkProductList ?? true}
          onChange={(e) => updateRule('checkProductList', e.target.checked)}
          className="h-4 w-4 rounded"
        />
        <span className="text-sm">Check product-specific suppression list</span>
      </label>
      <p className="text-sm text-muted-foreground">
        Suppression lists prevent content from being sent to specific recipients who have opted out or been excluded.
      </p>
    </div>
  );
}

// Time Window Configuration
function TimeWindowConfig({ rule, updateRule }: { rule: any; updateRule: any }) {
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const allowedDays = rule.allowedDays || [1, 2, 3, 4, 5];

  function toggleDay(dayIndex: number) {
    if (allowedDays.includes(dayIndex)) {
      updateRule('allowedDays', allowedDays.filter((d: number) => d !== dayIndex));
    } else {
      updateRule('allowedDays', [...allowedDays, dayIndex].sort());
    }
  }

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label>Allowed Days</Label>
        <div className="flex gap-2">
          {days.map((day, index) => (
            <button
              key={day}
              type="button"
              onClick={() => toggleDay(index)}
              className={`rounded px-3 py-1 text-sm font-medium ${
                allowedDays.includes(index)
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-secondary text-secondary-foreground'
              }`}
            >
              {day}
            </button>
          ))}
        </div>
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        <div className="space-y-2">
          <Label>Start Hour</Label>
          <Input
            type="number"
            value={rule.allowedHours?.start ?? 9}
            onChange={(e) =>
              updateRule('allowedHours', {
                ...rule.allowedHours,
                start: parseInt(e.target.value) || 0,
              })
            }
            min={0}
            max={23}
          />
        </div>
        <div className="space-y-2">
          <Label>End Hour</Label>
          <Input
            type="number"
            value={rule.allowedHours?.end ?? 17}
            onChange={(e) =>
              updateRule('allowedHours', {
                ...rule.allowedHours,
                end: parseInt(e.target.value) || 0,
              })
            }
            min={0}
            max={23}
          />
        </div>
        <div className="space-y-2">
          <Label>Timezone</Label>
          <Select
            value={rule.timezone || 'America/New_York'}
            onValueChange={(value) => updateRule('timezone', value)}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="America/New_York">Eastern (ET)</SelectItem>
              <SelectItem value="America/Chicago">Central (CT)</SelectItem>
              <SelectItem value="America/Denver">Mountain (MT)</SelectItem>
              <SelectItem value="America/Los_Angeles">Pacific (PT)</SelectItem>
              <SelectItem value="UTC">UTC</SelectItem>
              <SelectItem value="Europe/London">London (GMT)</SelectItem>
              <SelectItem value="Europe/Paris">Paris (CET)</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
    </div>
  );
}

// Budget Limit Configuration
function BudgetLimitConfig({ rule, updateRule }: { rule: any; updateRule: any }) {
  return (
    <div className="grid gap-4 md:grid-cols-3">
      <div className="space-y-2">
        <Label>Maximum Spend ($)</Label>
        <Input
          type="number"
          value={(rule.maxSpendCents || 0) / 100}
          onChange={(e) => updateRule('maxSpendCents', Math.round(parseFloat(e.target.value) * 100) || 0)}
          min={0}
          step="0.01"
        />
        <p className="text-xs text-muted-foreground">Enter amount in dollars</p>
      </div>
      <div className="space-y-2">
        <Label>Time Window</Label>
        <Select
          value={rule.window || 'month'}
          onValueChange={(value) => updateRule('window', value)}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="day">Per Day</SelectItem>
            <SelectItem value="week">Per Week</SelectItem>
            <SelectItem value="month">Per Month</SelectItem>
            <SelectItem value="campaign">Per Campaign</SelectItem>
            <SelectItem value="lifetime">Lifetime</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-2">
        <Label>Scope</Label>
        <Select
          value={rule.scope || 'campaign'}
          onValueChange={(value) => updateRule('scope', value)}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="campaign">Per Campaign</SelectItem>
            <SelectItem value="product">Per Product</SelectItem>
            <SelectItem value="organization">Organization</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}

// Content Rule Configuration
function ContentRuleConfig({ rule, updateRule }: { rule: any; updateRule: any }) {
  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label>Minimum Length</Label>
          <Input
            type="number"
            value={rule.minLength || 0}
            onChange={(e) => updateRule('minLength', parseInt(e.target.value) || 0)}
            min={0}
          />
          <p className="text-xs text-muted-foreground">Characters (0 = no minimum)</p>
        </div>
        <div className="space-y-2">
          <Label>Maximum Length</Label>
          <Input
            type="number"
            value={rule.maxLength || 280}
            onChange={(e) => updateRule('maxLength', parseInt(e.target.value) || 0)}
            min={0}
          />
          <p className="text-xs text-muted-foreground">Characters (0 = no maximum)</p>
        </div>
      </div>
    </div>
  );
}
