'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
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
import Link from 'next/link';
import {
  ArrowLeft,
  Loader2,
  Mail,
  Plus,
  Trash2,
  Clock,
  GripVertical,
} from 'lucide-react';
import { createNurtureSequence } from '@/lib/actions/nurture-sequences';

interface SequenceEmail {
  id: string;
  subject: string;
  delay_days: number;
  content: string;
}

const triggerOptions = [
  { id: 'lead_magnet_download', name: 'Lead Magnet Download', description: 'When someone downloads a lead magnet' },
  { id: 'form_submission', name: 'Form Submission', description: 'When a form is submitted' },
  { id: 'manual', name: 'Manual Enrollment', description: 'Manually add leads to this sequence' },
  { id: 'tag_added', name: 'Tag Added', description: 'When a specific tag is added to a lead' },
];

export default function NewSequencePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [trigger, setTrigger] = useState('lead_magnet_download');
  const [fromName, setFromName] = useState('');
  const [fromEmail, setFromEmail] = useState('');
  const [stopOnReply, setStopOnReply] = useState(true);
  const [stopOnConversion, setStopOnConversion] = useState(true);

  const [emails, setEmails] = useState<SequenceEmail[]>([
    { id: '1', subject: '', delay_days: 0, content: '' },
  ]);

  const addEmail = () => {
    const lastEmail = emails[emails.length - 1];
    setEmails([
      ...emails,
      {
        id: Date.now().toString(),
        subject: '',
        delay_days: (lastEmail?.delay_days || 0) + 3,
        content: '',
      },
    ]);
  };

  const removeEmail = (id: string) => {
    if (emails.length > 1) {
      setEmails(emails.filter(e => e.id !== id));
    }
  };

  const updateEmail = (id: string, field: keyof SequenceEmail, value: string | number) => {
    setEmails(emails.map(e =>
      e.id === id ? { ...e, [field]: value } : e
    ));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const result = await createNurtureSequence({
        name,
        description,
        trigger,
        fromName,
        fromEmail,
        stopOnReply,
        stopOnConversion,
        emails: emails.map((email, index) => ({
          subject: email.subject,
          delay_days: email.delay_days,
          content: email.content,
          order: index,
        })),
      });

      if (result.success) {
        router.push('/dashboard/growth/leads/sequences');
      } else {
        setError(result.error || 'Failed to create sequence');
      }
    } catch (err) {
      setError('An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/dashboard/growth/leads/sequences">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Sequences
          </Link>
        </Button>
      </div>

      <div>
        <h1 className="text-3xl font-bold">New Nurture Sequence</h1>
        <p className="text-muted-foreground">
          Create an automated email sequence to nurture your leads
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Basic Information</CardTitle>
            <CardDescription>
              Name your sequence and configure when it should trigger
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Sequence Name</Label>
              <Input
                id="name"
                placeholder="e.g., Welcome Series, Product Education"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description (optional)</Label>
              <Textarea
                id="description"
                placeholder="Describe the purpose of this sequence..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={2}
              />
            </div>

            <div className="space-y-2">
              <Label>Trigger</Label>
              <Select value={trigger} onValueChange={setTrigger}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {triggerOptions.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      <div>
                        <span className="font-medium">{t.name}</span>
                        <span className="ml-2 text-muted-foreground">- {t.description}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Sender Settings</CardTitle>
            <CardDescription>
              Configure who the emails appear to be from
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="fromName">From Name</Label>
                <Input
                  id="fromName"
                  placeholder="e.g., John from Acme"
                  value={fromName}
                  onChange={(e) => setFromName(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="fromEmail">From Email</Label>
                <Input
                  id="fromEmail"
                  type="email"
                  placeholder="e.g., john@acme.com"
                  value={fromEmail}
                  onChange={(e) => setFromEmail(e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-4 pt-4">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Stop on Reply</Label>
                  <p className="text-xs text-muted-foreground">
                    Stop sending emails when a lead replies
                  </p>
                </div>
                <Switch
                  checked={stopOnReply}
                  onCheckedChange={setStopOnReply}
                />
              </div>
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Stop on Conversion</Label>
                  <p className="text-xs text-muted-foreground">
                    Stop sending emails when a lead converts
                  </p>
                </div>
                <Switch
                  checked={stopOnConversion}
                  onCheckedChange={setStopOnConversion}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Email Sequence</CardTitle>
                <CardDescription>
                  Add emails to your sequence. Set delays between each email.
                </CardDescription>
              </div>
              <Button type="button" variant="outline" size="sm" onClick={addEmail}>
                <Plus className="mr-2 h-4 w-4" />
                Add Email
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {emails.map((email, index) => (
              <div
                key={email.id}
                className="rounded-lg border p-4 space-y-4"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground text-sm font-medium">
                      {index + 1}
                    </div>
                    <span className="font-medium">Email {index + 1}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Clock className="h-4 w-4" />
                      {index === 0 ? (
                        <span>Sent immediately</span>
                      ) : (
                        <div className="flex items-center gap-1">
                          <span>Wait</span>
                          <Input
                            type="number"
                            min="1"
                            className="w-16 h-7"
                            value={email.delay_days}
                            onChange={(e) => updateEmail(email.id, 'delay_days', parseInt(e.target.value) || 0)}
                          />
                          <span>days</span>
                        </div>
                      )}
                    </div>
                    {emails.length > 1 && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => removeEmail(email.id)}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    )}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Subject Line</Label>
                  <Input
                    placeholder="Enter email subject..."
                    value={email.subject}
                    onChange={(e) => updateEmail(email.id, 'subject', e.target.value)}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label>Email Content</Label>
                  <Textarea
                    placeholder="Write your email content... Use {{first_name}} for personalization."
                    value={email.content}
                    onChange={(e) => updateEmail(email.id, 'content', e.target.value)}
                    rows={6}
                    required
                  />
                  <p className="text-xs text-muted-foreground">
                    Available variables: {'{{first_name}}'}, {'{{last_name}}'}, {'{{email}}'}, {'{{company}}'}
                  </p>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        {error && (
          <div className="rounded-lg border border-destructive bg-destructive/10 p-4 text-destructive">
            {error}
          </div>
        )}

        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" asChild>
            <Link href="/dashboard/growth/leads/sequences">Cancel</Link>
          </Button>
          <Button type="submit" disabled={loading || !name || emails.some(e => !e.subject || !e.content)}>
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Create Sequence
          </Button>
        </div>
      </form>
    </div>
  );
}
