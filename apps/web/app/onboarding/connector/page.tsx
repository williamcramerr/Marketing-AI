'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  advanceOnboardingStep,
  skipOnboardingStep,
} from '@/lib/actions/onboarding';
import { Plug, ArrowRight, SkipForward, Check } from 'lucide-react';
import { cn } from '@/lib/utils';

const connectors = [
  {
    id: 'linkedin',
    name: 'LinkedIn',
    description: 'Post updates and articles',
    icon: '/icons/linkedin.svg',
    available: true,
  },
  {
    id: 'twitter',
    name: 'Twitter/X',
    description: 'Share tweets and threads',
    icon: '/icons/twitter.svg',
    available: true,
  },
  {
    id: 'meta',
    name: 'Meta (Facebook/Instagram)',
    description: 'Post to Facebook and Instagram',
    icon: '/icons/meta.svg',
    available: true,
  },
  {
    id: 'google',
    name: 'Google Ads',
    description: 'Manage ad campaigns',
    icon: '/icons/google.svg',
    available: true,
  },
  {
    id: 'email',
    name: 'Email (Resend)',
    description: 'Send marketing emails',
    icon: '/icons/email.svg',
    available: true,
  },
  {
    id: 'wordpress',
    name: 'WordPress',
    description: 'Publish blog posts',
    icon: '/icons/wordpress.svg',
    available: false,
    comingSoon: true,
  },
];

export default function ConnectorPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [selectedConnector, setSelectedConnector] = useState<string | null>(null);
  const [connectedConnectors, setConnectedConnectors] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  async function handleConnect(connectorId: string) {
    setSelectedConnector(connectorId);
    // In a real app, this would trigger OAuth flow
    // For now, we simulate it
    await new Promise((resolve) => setTimeout(resolve, 1000));
    setConnectedConnectors((prev) => [...prev, connectorId]);
    setSelectedConnector(null);
  }

  async function handleContinue() {
    setIsLoading(true);
    setError(null);
    try {
      const result = await advanceOnboardingStep('connector', {
        connectedConnectors,
      });

      if (result.success && result.nextStep) {
        router.push(`/onboarding/${result.nextStep}`);
      } else {
        setError(result.error || 'Failed to advance to next step');
      }
    } catch (error) {
      console.error('Error advancing step:', error);
      setError('An unexpected error occurred');
    } finally {
      setIsLoading(false);
    }
  }

  async function handleSkip() {
    setIsLoading(true);
    setError(null);
    try {
      const result = await skipOnboardingStep('connector');

      if (result.success && result.nextStep) {
        router.push(`/onboarding/${result.nextStep}`);
      } else {
        setError(result.error || 'Failed to skip step');
      }
    } catch (error) {
      console.error('Error skipping step:', error);
      setError('An unexpected error occurred');
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <Card className="border-0 shadow-lg">
      <CardHeader className="text-center pb-2">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
          <Plug className="h-8 w-8 text-primary" />
        </div>
        <CardTitle className="text-2xl">Connect Your Tools</CardTitle>
        <CardDescription className="text-base mt-2">
          Connect your marketing channels to publish content automatically. You can skip this and add them later.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 pt-6">
        <div className="grid gap-3">
          {connectors.map((connector) => {
            const isConnected = connectedConnectors.includes(connector.id);
            const isConnecting = selectedConnector === connector.id;

            return (
              <div
                key={connector.id}
                className={cn(
                  'flex items-center justify-between rounded-lg border p-4 transition-colors',
                  isConnected && 'border-primary bg-primary/5',
                  connector.comingSoon && 'opacity-60'
                )}
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted">
                    <span className="text-sm font-medium">
                      {connector.name.charAt(0)}
                    </span>
                  </div>
                  <div>
                    <p className="font-medium">{connector.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {connector.description}
                    </p>
                  </div>
                </div>
                {connector.comingSoon ? (
                  <span className="text-xs text-muted-foreground">Coming soon</span>
                ) : isConnected ? (
                  <div className="flex items-center gap-1 text-sm text-primary">
                    <Check className="h-4 w-4" />
                    Connected
                  </div>
                ) : (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleConnect(connector.id)}
                    disabled={isConnecting || isLoading}
                  >
                    {isConnecting ? 'Connecting...' : 'Connect'}
                  </Button>
                )}
              </div>
            );
          })}
        </div>
        {error && (
          <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
            {error}
          </div>
        )}
      </CardContent>
      <CardFooter className="flex flex-col gap-3 pt-4">
        {connectedConnectors.length > 0 ? (
          <Button
            size="lg"
            onClick={handleContinue}
            disabled={isLoading}
            className="min-w-[200px]"
          >
            {isLoading ? 'Loading...' : 'Continue'}
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        ) : (
          <Button
            variant="outline"
            size="lg"
            onClick={handleSkip}
            disabled={isLoading}
            className="min-w-[200px]"
          >
            {isLoading ? 'Loading...' : 'Skip for now'}
            <SkipForward className="ml-2 h-4 w-4" />
          </Button>
        )}
        <p className="text-xs text-muted-foreground">
          You can always connect more tools from the dashboard.
        </p>
      </CardFooter>
    </Card>
  );
}
