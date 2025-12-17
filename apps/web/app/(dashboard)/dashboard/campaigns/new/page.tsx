import { getProducts, getAudiences, createCampaign } from '@/lib/actions/campaigns';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

export default async function NewCampaignPage() {
  const products = await getProducts();
  const audiences = await getAudiences();

  const availableChannels = ['Email', 'Social Media', 'Blog', 'Ads', 'SEO', 'Landing Pages'];

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/dashboard/campaigns">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-3xl font-bold">Create Campaign</h1>
          <p className="text-muted-foreground">Set up a new marketing campaign</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Campaign Details</CardTitle>
          <CardDescription>
            Define the goals, channels, and timeline for your campaign
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form action={createCampaign} className="space-y-6">
            <div className="grid gap-6 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="product_id">
                  Product <span className="text-destructive">*</span>
                </Label>
                <Select name="product_id" required>
                  <SelectTrigger id="product_id">
                    <SelectValue placeholder="Select a product" />
                  </SelectTrigger>
                  <SelectContent>
                    {products && products.length > 0 ? (
                      products.map((product) => (
                        <SelectItem key={product.id} value={product.id}>
                          {product.name}
                        </SelectItem>
                      ))
                    ) : (
                      <SelectItem value="none" disabled>
                        No products available
                      </SelectItem>
                    )}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="audience_id">Target Audience</Label>
                <Select name="audience_id">
                  <SelectTrigger id="audience_id">
                    <SelectValue placeholder="Select an audience (optional)" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="_none_">None</SelectItem>
                    {audiences && audiences.length > 0 ? (
                      audiences.map((audience) => (
                        <SelectItem key={audience.id} value={audience.id}>
                          {audience.name}
                        </SelectItem>
                      ))
                    ) : (
                      <SelectItem value="none" disabled>
                        No audiences available
                      </SelectItem>
                    )}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="name">
                Campaign Name <span className="text-destructive">*</span>
              </Label>
              <Input
                id="name"
                name="name"
                placeholder="e.g., Q1 Product Launch"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                name="description"
                placeholder="Describe the purpose and approach of this campaign"
                rows={3}
              />
            </div>

            <div className="grid gap-6 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="goal">
                  Goal <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="goal"
                  name="goal"
                  placeholder="e.g., Generate leads, Increase awareness"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="goal_metric">Goal Metric</Label>
                <Input
                  id="goal_metric"
                  name="goal_metric"
                  placeholder="e.g., Signups, Website visits"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="goal_target">Goal Target (numeric)</Label>
              <Input
                id="goal_target"
                name="goal_target"
                type="number"
                placeholder="e.g., 1000"
                min="0"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="channels">Channels</Label>
              <div className="rounded-md border p-4">
                <p className="mb-3 text-sm text-muted-foreground">
                  Enter comma-separated channel names
                </p>
                <Input
                  id="channels"
                  name="channels"
                  placeholder="e.g., Email, Social Media, Blog"
                />
                <div className="mt-2 flex flex-wrap gap-2">
                  <p className="w-full text-xs text-muted-foreground">Suggestions:</p>
                  {availableChannels.map((channel) => (
                    <span
                      key={channel}
                      className="rounded-full bg-muted px-2 py-1 text-xs"
                    >
                      {channel}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            <div className="grid gap-6 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="start_date">Start Date</Label>
                <Input id="start_date" name="start_date" type="date" />
              </div>

              <div className="space-y-2">
                <Label htmlFor="end_date">End Date</Label>
                <Input id="end_date" name="end_date" type="date" />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="budget_cents">Budget (in cents)</Label>
              <Input
                id="budget_cents"
                name="budget_cents"
                type="number"
                placeholder="e.g., 100000 for $1,000"
                min="0"
              />
              <p className="text-xs text-muted-foreground">
                Enter amount in cents (e.g., 100000 = $1,000.00)
              </p>
            </div>

            <div className="flex gap-4">
              <Button type="submit">Create Campaign</Button>
              <Link href="/dashboard/campaigns">
                <Button type="button" variant="outline">
                  Cancel
                </Button>
              </Link>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
