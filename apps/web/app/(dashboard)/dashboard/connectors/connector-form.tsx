'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2 } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { createConnector, updateConnector, testConnector } from '@/lib/actions/connectors';

const connectorTypes = [
  { value: 'email_resend', label: 'Resend Email', description: 'Send transactional and marketing emails' },
  { value: 'social_twitter', label: 'Twitter/X', description: 'Post to Twitter/X social platform' },
  { value: 'social_linkedin', label: 'LinkedIn', description: 'Post to LinkedIn company pages' },
  { value: 'cms_ghost', label: 'Ghost CMS', description: 'Publish blog posts to Ghost' },
  { value: 'cms_wordpress', label: 'WordPress', description: 'Publish content to WordPress sites' },
  { value: 'ads_google', label: 'Google Ads', description: 'Create and manage Google Ads campaigns' },
  { value: 'ads_facebook', label: 'Meta Ads', description: 'Create and manage Facebook/Instagram ads' },
];

interface ConnectorFormProps {
  connector?: {
    id: string;
    name: string;
    type: string;
    description: string | null;
    config: Record<string, any>;
    approval_required: boolean;
    rate_limit_per_hour: number | null;
    rate_limit_per_day: number | null;
    active: boolean;
  };
}

export function ConnectorForm({ connector }: ConnectorFormProps) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [connectorType, setConnectorType] = useState(connector?.type || '');

  const [formData, setFormData] = useState({
    name: connector?.name || '',
    description: connector?.description || '',
    approval_required: connector?.approval_required || false,
    rate_limit_per_hour: connector?.rate_limit_per_hour?.toString() || '',
    rate_limit_per_day: connector?.rate_limit_per_day?.toString() || '',
    active: connector?.active ?? true,
    config: connector?.config || {},
  });

  function updateFormData(field: string, value: any) {
    setFormData((prev) => ({ ...prev, [field]: value }));
  }

  function updateConfig(field: string, value: any) {
    setFormData((prev) => ({
      ...prev,
      config: { ...prev.config, [field]: value },
    }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setIsLoading(true);

    try {
      const input = {
        name: formData.name,
        type: connectorType,
        description: formData.description || undefined,
        config: formData.config,
        approval_required: formData.approval_required,
        rate_limit_per_hour: formData.rate_limit_per_hour
          ? parseInt(formData.rate_limit_per_hour)
          : undefined,
        rate_limit_per_day: formData.rate_limit_per_day
          ? parseInt(formData.rate_limit_per_day)
          : undefined,
        active: formData.active,
      };

      const result = connector
        ? await updateConnector(connector.id, input)
        : await createConnector(input);

      if (result.success) {
        toast({
          title: connector ? 'Connector updated' : 'Connector created',
          description: `${formData.name} has been ${connector ? 'updated' : 'created'}`,
        });
        router.push('/dashboard/connectors');
      } else {
        toast({
          title: 'Error',
          description: result.error || 'Failed to save connector',
          variant: 'destructive',
        });
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'An unexpected error occurred',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  }

  async function handleTest() {
    if (!connector) return;

    setIsTesting(true);
    try {
      const result = await testConnector(connector.id);

      if (result.success) {
        toast({
          title: 'Test successful',
          description: result.message || 'Connector configuration is valid',
        });
      } else {
        toast({
          title: 'Test failed',
          description: result.error || 'Configuration validation failed',
          variant: 'destructive',
        });
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'An unexpected error occurred',
        variant: 'destructive',
      });
    } finally {
      setIsTesting(false);
    }
  }

  function renderConfigFields() {
    switch (connectorType) {
      case 'email_resend':
        return (
          <div className="space-y-4">
            <div className="grid gap-2">
              <Label htmlFor="api_key">API Key</Label>
              <Input
                id="api_key"
                type="password"
                placeholder="re_..."
                value={formData.config.api_key || ''}
                onChange={(e) => updateConfig('api_key', e.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="from_email">Default From Email</Label>
              <Input
                id="from_email"
                type="email"
                placeholder="noreply@example.com"
                value={formData.config.from_email || ''}
                onChange={(e) => updateConfig('from_email', e.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="from_name">Default From Name</Label>
              <Input
                id="from_name"
                placeholder="Your Company"
                value={formData.config.from_name || ''}
                onChange={(e) => updateConfig('from_name', e.target.value)}
              />
            </div>
          </div>
        );

      case 'social_twitter':
        return (
          <div className="space-y-4">
            <div className="grid gap-2">
              <Label htmlFor="api_key">API Key</Label>
              <Input
                id="api_key"
                type="password"
                value={formData.config.api_key || ''}
                onChange={(e) => updateConfig('api_key', e.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="api_secret">API Secret</Label>
              <Input
                id="api_secret"
                type="password"
                value={formData.config.api_secret || ''}
                onChange={(e) => updateConfig('api_secret', e.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="access_token">Access Token</Label>
              <Input
                id="access_token"
                type="password"
                value={formData.config.access_token || ''}
                onChange={(e) => updateConfig('access_token', e.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="access_token_secret">Access Token Secret</Label>
              <Input
                id="access_token_secret"
                type="password"
                value={formData.config.access_token_secret || ''}
                onChange={(e) => updateConfig('access_token_secret', e.target.value)}
              />
            </div>
          </div>
        );

      case 'social_linkedin':
        return (
          <div className="space-y-4">
            <div className="grid gap-2">
              <Label htmlFor="access_token">Access Token</Label>
              <Input
                id="access_token"
                type="password"
                value={formData.config.access_token || ''}
                onChange={(e) => updateConfig('access_token', e.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="organization_id">Organization ID</Label>
              <Input
                id="organization_id"
                placeholder="urn:li:organization:12345"
                value={formData.config.organization_id || ''}
                onChange={(e) => updateConfig('organization_id', e.target.value)}
              />
            </div>
          </div>
        );

      case 'cms_ghost':
        return (
          <div className="space-y-4">
            <div className="grid gap-2">
              <Label htmlFor="url">Ghost URL</Label>
              <Input
                id="url"
                placeholder="https://your-blog.ghost.io"
                value={formData.config.url || ''}
                onChange={(e) => updateConfig('url', e.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="admin_api_key">Admin API Key</Label>
              <Input
                id="admin_api_key"
                type="password"
                value={formData.config.admin_api_key || ''}
                onChange={(e) => updateConfig('admin_api_key', e.target.value)}
              />
            </div>
          </div>
        );

      case 'cms_wordpress':
        return (
          <div className="space-y-4">
            <div className="grid gap-2">
              <Label htmlFor="url">WordPress URL</Label>
              <Input
                id="url"
                placeholder="https://your-site.com"
                value={formData.config.url || ''}
                onChange={(e) => updateConfig('url', e.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="username">Username</Label>
              <Input
                id="username"
                value={formData.config.username || ''}
                onChange={(e) => updateConfig('username', e.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="password">Application Password</Label>
              <Input
                id="password"
                type="password"
                value={formData.config.password || ''}
                onChange={(e) => updateConfig('password', e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Use an Application Password from WordPress settings
              </p>
            </div>
          </div>
        );

      case 'ads_google':
        return (
          <div className="space-y-4">
            <div className="grid gap-2">
              <Label htmlFor="customer_id">Customer ID</Label>
              <Input
                id="customer_id"
                placeholder="123-456-7890"
                value={formData.config.customer_id || ''}
                onChange={(e) => updateConfig('customer_id', e.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="developer_token">Developer Token</Label>
              <Input
                id="developer_token"
                type="password"
                value={formData.config.developer_token || ''}
                onChange={(e) => updateConfig('developer_token', e.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="client_id">OAuth Client ID</Label>
              <Input
                id="client_id"
                value={formData.config.client_id || ''}
                onChange={(e) => updateConfig('client_id', e.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="client_secret">OAuth Client Secret</Label>
              <Input
                id="client_secret"
                type="password"
                value={formData.config.client_secret || ''}
                onChange={(e) => updateConfig('client_secret', e.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="refresh_token">Refresh Token</Label>
              <Input
                id="refresh_token"
                type="password"
                value={formData.config.refresh_token || ''}
                onChange={(e) => updateConfig('refresh_token', e.target.value)}
              />
            </div>
          </div>
        );

      case 'ads_facebook':
        return (
          <div className="space-y-4">
            <div className="grid gap-2">
              <Label htmlFor="access_token">Access Token</Label>
              <Input
                id="access_token"
                type="password"
                value={formData.config.access_token || ''}
                onChange={(e) => updateConfig('access_token', e.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="ad_account_id">Ad Account ID</Label>
              <Input
                id="ad_account_id"
                placeholder="act_123456789"
                value={formData.config.ad_account_id || ''}
                onChange={(e) => updateConfig('ad_account_id', e.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="page_id">Page ID (optional)</Label>
              <Input
                id="page_id"
                placeholder="For Instagram, provide the connected Page ID"
                value={formData.config.page_id || ''}
                onChange={(e) => updateConfig('page_id', e.target.value)}
              />
            </div>
          </div>
        );

      default:
        return (
          <p className="text-sm text-muted-foreground">
            Select a connector type to configure credentials
          </p>
        );
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Basic Info */}
      <Card>
        <CardHeader>
          <CardTitle>Basic Information</CardTitle>
          <CardDescription>Configure the connector name and type</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-2">
            <Label htmlFor="name">Name</Label>
            <Input
              id="name"
              placeholder="My Email Connector"
              value={formData.name}
              onChange={(e) => updateFormData('name', e.target.value)}
              required
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="type">Type</Label>
            <Select
              value={connectorType}
              onValueChange={setConnectorType}
              disabled={!!connector}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select connector type" />
              </SelectTrigger>
              <SelectContent>
                {connectorTypes.map((type) => (
                  <SelectItem key={type.value} value={type.value}>
                    <div className="flex flex-col">
                      <span>{type.label}</span>
                      <span className="text-xs text-muted-foreground">{type.description}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              placeholder="Optional description for this connector"
              value={formData.description}
              onChange={(e) => updateFormData('description', e.target.value)}
            />
          </div>
        </CardContent>
      </Card>

      {/* Configuration */}
      {connectorType && (
        <Card>
          <CardHeader>
            <CardTitle>Configuration</CardTitle>
            <CardDescription>Enter the credentials for this connector</CardDescription>
          </CardHeader>
          <CardContent>{renderConfigFields()}</CardContent>
        </Card>
      )}

      {/* Settings */}
      <Card>
        <CardHeader>
          <CardTitle>Settings</CardTitle>
          <CardDescription>Configure approval and rate limiting</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between rounded-lg border p-4">
            <div className="space-y-0.5">
              <Label htmlFor="active">Active</Label>
              <p className="text-sm text-muted-foreground">
                Enable or disable this connector
              </p>
            </div>
            <Switch
              id="active"
              checked={formData.active}
              onCheckedChange={(checked) => updateFormData('active', checked)}
            />
          </div>

          <div className="flex items-center justify-between rounded-lg border p-4">
            <div className="space-y-0.5">
              <Label htmlFor="approval_required">Require Approval</Label>
              <p className="text-sm text-muted-foreground">
                Require human approval before executing actions
              </p>
            </div>
            <Switch
              id="approval_required"
              checked={formData.approval_required}
              onCheckedChange={(checked) => updateFormData('approval_required', checked)}
            />
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="rate_limit_per_hour">Rate Limit (per hour)</Label>
              <Input
                id="rate_limit_per_hour"
                type="number"
                min="0"
                placeholder="No limit"
                value={formData.rate_limit_per_hour}
                onChange={(e) => updateFormData('rate_limit_per_hour', e.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="rate_limit_per_day">Rate Limit (per day)</Label>
              <Input
                id="rate_limit_per_day"
                type="number"
                min="0"
                placeholder="No limit"
                value={formData.rate_limit_per_day}
                onChange={(e) => updateFormData('rate_limit_per_day', e.target.value)}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Actions */}
      <div className="flex justify-end gap-4">
        <Button
          type="button"
          variant="outline"
          onClick={() => router.push('/dashboard/connectors')}
        >
          Cancel
        </Button>
        {connector && (
          <Button
            type="button"
            variant="outline"
            onClick={handleTest}
            disabled={isTesting}
          >
            {isTesting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Testing...
              </>
            ) : (
              'Test Connection'
            )}
          </Button>
        )}
        <Button type="submit" disabled={isLoading || !connectorType}>
          {isLoading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Saving...
            </>
          ) : connector ? (
            'Update Connector'
          ) : (
            'Create Connector'
          )}
        </Button>
      </div>
    </form>
  );
}
