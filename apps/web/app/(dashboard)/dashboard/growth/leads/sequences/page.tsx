import { createClient } from '@/lib/supabase/server';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import Link from 'next/link';
import {
  Plus,
  Mail,
  ArrowLeft,
  Play,
  Pause,
  Edit,
  Trash2,
  Clock,
  Users,
  MailOpen,
  CheckCircle,
} from 'lucide-react';

const statusColors: Record<string, string> = {
  active: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
  paused: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
  draft: 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200',
};

export default async function SequencesPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: membership } = await supabase
    .from('organization_members')
    .select('organization_id')
    .eq('user_id', user!.id)
    .limit(1)
    .single();

  if (!membership) {
    return (
      <div className="flex flex-col items-center justify-center py-24">
        <h1 className="mb-2 text-2xl font-bold">No Organization Found</h1>
        <p className="text-muted-foreground">Please create an organization first.</p>
      </div>
    );
  }

  // Fetch nurture sequences
  const { data: sequences } = await supabase
    .from('nurture_sequences')
    .select('*')
    .eq('organization_id', membership.organization_id)
    .order('created_at', { ascending: false });

  // Calculate stats
  const totalSequences = sequences?.length || 0;
  const activeSequences = sequences?.filter(s => s.status === 'active').length || 0;
  const totalEmails = sequences?.reduce((sum, s) => sum + (s.email_count || 0), 0) || 0;
  const totalEnrolled = sequences?.reduce((sum, s) => sum + (s.enrolled_count || 0), 0) || 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/dashboard/growth/leads">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Leads
          </Link>
        </Button>
      </div>

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Nurture Sequences</h1>
          <p className="text-muted-foreground">
            Automated email sequences to engage and convert leads
          </p>
        </div>
        <Button asChild>
          <Link href="/dashboard/growth/leads/sequences/new">
            <Plus className="mr-2 h-4 w-4" />
            New Sequence
          </Link>
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Sequences
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalSequences}</div>
            <p className="text-xs text-muted-foreground">{activeSequences} active</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Emails
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalEmails}</div>
            <p className="text-xs text-muted-foreground">across all sequences</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Leads Enrolled
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalEnrolled}</div>
            <p className="text-xs text-muted-foreground">in nurture sequences</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Active Rate
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {totalSequences > 0 ? Math.round((activeSequences / totalSequences) * 100) : 0}%
            </div>
            <p className="text-xs text-muted-foreground">sequences running</p>
          </CardContent>
        </Card>
      </div>

      {/* Sequences List */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            <div>
              <CardTitle>All Sequences</CardTitle>
              <CardDescription>
                Manage your automated email nurture sequences
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {sequences && sequences.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Emails</TableHead>
                  <TableHead>Enrolled</TableHead>
                  <TableHead>Open Rate</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sequences.map((sequence) => (
                  <TableRow key={sequence.id}>
                    <TableCell>
                      <div>
                        <div className="font-medium">{sequence.name}</div>
                        {sequence.description && (
                          <div className="text-xs text-muted-foreground line-clamp-1">
                            {sequence.description}
                          </div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Mail className="h-3.5 w-3.5 text-muted-foreground" />
                        {sequence.email_count || 0}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Users className="h-3.5 w-3.5 text-muted-foreground" />
                        {sequence.enrolled_count || 0}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <MailOpen className="h-3.5 w-3.5 text-muted-foreground" />
                        {sequence.open_rate ? `${sequence.open_rate}%` : '-'}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge className={statusColors[sequence.status] || statusColors.draft}>
                        {sequence.status || 'draft'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button variant="ghost" size="sm" asChild>
                          <Link href={`/dashboard/growth/leads/sequences/${sequence.id}`}>
                            <Edit className="h-4 w-4" />
                          </Link>
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="flex h-32 flex-col items-center justify-center gap-2 text-sm text-muted-foreground">
              <Mail className="h-8 w-8 opacity-50" />
              <p>No nurture sequences yet</p>
              <Button asChild size="sm">
                <Link href="/dashboard/growth/leads/sequences/new">
                  <Plus className="mr-2 h-4 w-4" />
                  Create Your First Sequence
                </Link>
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
