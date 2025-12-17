import { Suspense } from 'react';
import Link from 'next/link';
import { Plus, Shield, AlertTriangle, Ban, ArrowUpRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { getPolicies } from '@/lib/actions/policies';
import { getPolicyTypeDisplayName, getSeverityDisplayInfo } from '@/lib/utils/policy-utils';
import { formatDate } from '@/lib/utils';
import { TogglePolicyButton } from './toggle-policy-button';
import { DeletePolicyButton } from './delete-policy-button';

function PoliciesLoading() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Policies</h1>
          <p className="text-muted-foreground">Manage content and execution guardrails</p>
        </div>
      </div>
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-center py-12">
            <p className="text-muted-foreground">Loading policies...</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function SeverityBadge({ severity }: { severity: string }) {
  const info = getSeverityDisplayInfo(severity as 'warn' | 'block' | 'escalate');
  const Icon = severity === 'block' ? Ban : severity === 'escalate' ? ArrowUpRight : AlertTriangle;

  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-medium ${info.bgColor} ${info.color}`}>
      <Icon className="h-3 w-3" />
      {info.label}
    </span>
  );
}

async function PoliciesList() {
  const result = await getPolicies();

  if (!result.success || !result.data) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-center py-12">
            <p className="text-destructive">Error loading policies: {result.error}</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const policies = result.data;

  if (policies.length === 0) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex flex-col items-center justify-center py-12">
            <Shield className="mb-4 h-12 w-12 text-muted-foreground" />
            <h3 className="mb-2 text-lg font-semibold">No policies configured</h3>
            <p className="mb-4 max-w-md text-center text-sm text-muted-foreground">
              Policies help ensure your marketing content follows your guidelines and regulations.
              Create policies to block prohibited content, enforce required disclaimers, and more.
            </p>
            <Link href="/dashboard/policies/new">
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                Create Policy
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Group policies by type for summary
  const policyStats = {
    total: policies.length,
    active: policies.filter(p => p.active).length,
    blocking: policies.filter(p => p.severity === 'block').length,
  };

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total Policies</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{policyStats.total}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Active Policies</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{policyStats.active}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Blocking Rules</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{policyStats.blocking}</div>
          </CardContent>
        </Card>
      </div>

      {/* Policies Table */}
      <Card>
        <CardHeader>
          <CardTitle>All Policies</CardTitle>
          <CardDescription>
            Configure rules that validate content before publishing
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Severity</TableHead>
                <TableHead>Scope</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Updated</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {policies.map((policy) => (
                <TableRow key={policy.id}>
                  <TableCell>
                    <Link
                      href={`/dashboard/policies/${policy.id}`}
                      className="font-medium hover:underline"
                    >
                      {policy.name}
                    </Link>
                    {policy.description && (
                      <p className="mt-1 text-xs text-muted-foreground line-clamp-1">
                        {policy.description}
                      </p>
                    )}
                  </TableCell>
                  <TableCell>
                    <span className="rounded bg-secondary px-2 py-1 text-xs font-medium">
                      {getPolicyTypeDisplayName(policy.type as any)}
                    </span>
                  </TableCell>
                  <TableCell>
                    <SeverityBadge severity={policy.severity} />
                  </TableCell>
                  <TableCell>
                    {policy.product ? (
                      <span className="text-sm">{policy.product.name}</span>
                    ) : (
                      <span className="text-sm text-muted-foreground">Organization-wide</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <span
                      className={`rounded-full px-2 py-1 text-xs font-medium ${
                        policy.active
                          ? 'bg-green-100 text-green-800'
                          : 'bg-gray-100 text-gray-800'
                      }`}
                    >
                      {policy.active ? 'Active' : 'Inactive'}
                    </span>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {formatDate(policy.updated_at)}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-2">
                      <Link href={`/dashboard/policies/${policy.id}`}>
                        <Button variant="outline" size="sm">
                          Edit
                        </Button>
                      </Link>
                      <TogglePolicyButton
                        policyId={policy.id}
                        currentActive={policy.active}
                      />
                      <DeletePolicyButton
                        policyId={policy.id}
                        policyName={policy.name}
                      />
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

export default function PoliciesPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Policies</h1>
          <p className="text-muted-foreground">
            Manage content and execution guardrails for your marketing automation
          </p>
        </div>
        <Link href="/dashboard/policies/new">
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            Create Policy
          </Button>
        </Link>
      </div>

      <Suspense fallback={<PoliciesLoading />}>
        <PoliciesList />
      </Suspense>
    </div>
  );
}
