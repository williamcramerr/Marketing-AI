'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Trash2, Save, Loader2, Package } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ToneSelector, ToneVisualizer } from '@/components/brand/tone-selector';
import { BrandGuidelines } from '@/components/brand/guideline-list';
import { VoicePreview } from '@/components/brand/voice-preview';
import { useToast } from '@/hooks/use-toast';
import {
  createVoiceProfile,
  updateVoiceProfile,
  deleteVoiceProfile,
  type ToneSettings,
  type BrandVoiceProfile,
} from '@/lib/actions/brand-voice';
import { EmptyState } from '@/components/common/empty-state';

interface Product {
  id: string;
  name: string;
}

interface BrandVoiceClientProps {
  profiles: BrandVoiceProfile[];
  products: Product[];
}

const DEFAULT_TONE: ToneSettings = {
  formality: 50,
  friendliness: 50,
  humor: 30,
  confidence: 60,
  enthusiasm: 50,
};

const WRITING_STYLES = [
  { value: 'conversational', label: 'Conversational', description: 'Natural, dialogue-like flow' },
  { value: 'technical', label: 'Technical', description: 'Precise, detailed, factual' },
  { value: 'storytelling', label: 'Storytelling', description: 'Narrative, engaging, emotional' },
  { value: 'persuasive', label: 'Persuasive', description: 'Compelling, action-oriented' },
  { value: 'educational', label: 'Educational', description: 'Informative, clear, instructional' },
];

export function BrandVoiceClient({ profiles, products }: BrandVoiceClientProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();
  const [showNewDialog, setShowNewDialog] = useState(false);
  const [selectedProfile, setSelectedProfile] = useState<BrandVoiceProfile | null>(
    profiles.find((p) => p.active) || profiles[0] || null
  );

  // Form state
  const [name, setName] = useState(selectedProfile?.name || '');
  const [description, setDescription] = useState(selectedProfile?.description || '');
  const [productId, setProductId] = useState(selectedProfile?.product_id || '');
  const [toneSettings, setToneSettings] = useState<ToneSettings>(
    selectedProfile?.tone_settings || DEFAULT_TONE
  );
  const [writingStyle, setWritingStyle] = useState(selectedProfile?.writing_style || 'conversational');
  const [dos, setDos] = useState<string[]>(selectedProfile?.guidelines_dos || []);
  const [donts, setDonts] = useState<string[]>(selectedProfile?.guidelines_donts || []);
  const [vocabularyPreferences, setVocabularyPreferences] = useState<string[]>(
    selectedProfile?.vocabulary_preferences || []
  );
  const [wordsToAvoid, setWordsToAvoid] = useState<string[]>(
    selectedProfile?.words_to_avoid || []
  );

  // New profile state
  const [newName, setNewName] = useState('');
  const [newProductId, setNewProductId] = useState('');

  const selectProfile = (profile: BrandVoiceProfile) => {
    setSelectedProfile(profile);
    setName(profile.name);
    setDescription(profile.description || '');
    setProductId(profile.product_id);
    setToneSettings(profile.tone_settings);
    setWritingStyle(profile.writing_style);
    setDos(profile.guidelines_dos);
    setDonts(profile.guidelines_donts);
    setVocabularyPreferences(profile.vocabulary_preferences);
    setWordsToAvoid(profile.words_to_avoid);
  };

  const handleCreateProfile = async () => {
    if (!newName.trim() || !newProductId) return;

    startTransition(async () => {
      const result = await createVoiceProfile({
        productId: newProductId,
        name: newName.trim(),
        toneSettings: DEFAULT_TONE,
        writingStyle: 'conversational',
      });

      if (result.success && result.profile) {
        toast({
          title: 'Profile Created',
          description: 'Your new brand voice profile has been created.',
        });
        setShowNewDialog(false);
        setNewName('');
        setNewProductId('');
        selectProfile(result.profile);
        router.refresh();
      } else {
        toast({
          title: 'Error',
          description: result.error || 'Failed to create profile.',
          variant: 'destructive',
        });
      }
    });
  };

  const handleSaveProfile = async () => {
    if (!selectedProfile) return;

    startTransition(async () => {
      const result = await updateVoiceProfile(selectedProfile.id, {
        name,
        description,
        toneSettings,
        writingStyle,
        guidelinesDos: dos,
        guidelinesDonts: donts,
        vocabularyPreferences,
        wordsToAvoid,
      });

      if (result.success) {
        toast({
          title: 'Profile Saved',
          description: 'Your brand voice settings have been updated.',
        });
        router.refresh();
      } else {
        toast({
          title: 'Error',
          description: result.error || 'Failed to save profile.',
          variant: 'destructive',
        });
      }
    });
  };

  const handleDeleteProfile = async () => {
    if (!selectedProfile) return;

    startTransition(async () => {
      const result = await deleteVoiceProfile(selectedProfile.id);

      if (result.success) {
        toast({
          title: 'Profile Deleted',
          description: 'The brand voice profile has been removed.',
        });
        setSelectedProfile(null);
        router.refresh();
      } else {
        toast({
          title: 'Error',
          description: result.error || 'Failed to delete profile.',
          variant: 'destructive',
        });
      }
    });
  };

  if (products.length === 0) {
    return (
      <EmptyState
        icon={Package}
        title="No products yet"
        description="Create a product first to configure its brand voice."
        actionLabel="Add Product"
        actionHref="/dashboard/products/new"
      />
    );
  }

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      {/* Profiles List */}
      <Card className="lg:col-span-1">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">Voice Profiles</CardTitle>
            <Button size="sm" onClick={() => setShowNewDialog(true)}>
              <Plus className="mr-2 h-4 w-4" />
              New
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {profiles.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              No voice profiles yet. Create one to get started.
            </p>
          ) : (
            <div className="space-y-2">
              {profiles.map((profile) => (
                <button
                  key={profile.id}
                  onClick={() => selectProfile(profile)}
                  className={`w-full rounded-lg border p-3 text-left transition-colors hover:bg-accent ${
                    selectedProfile?.id === profile.id ? 'border-primary bg-primary/5' : ''
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">{profile.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {(profile as any).products?.name || 'Unknown product'}
                      </p>
                    </div>
                    {profile.active && (
                      <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs text-green-800 dark:bg-green-900/30 dark:text-green-400">
                        Active
                      </span>
                    )}
                  </div>
                  <div className="mt-2">
                    <ToneVisualizer tone={profile.tone_settings} />
                  </div>
                </button>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Profile Editor */}
      <div className="space-y-6 lg:col-span-2">
        {selectedProfile ? (
          <>
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Edit Voice Profile</CardTitle>
                    <CardDescription>
                      Configure tone, style, and guidelines for {selectedProfile.name}
                    </CardDescription>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={handleDeleteProfile}
                      disabled={isPending}
                    >
                      <Trash2 className="mr-2 h-4 w-4" />
                      Delete
                    </Button>
                    <Button onClick={handleSaveProfile} disabled={isPending}>
                      {isPending ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <Save className="mr-2 h-4 w-4" />
                      )}
                      Save Changes
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <Tabs defaultValue="tone" className="space-y-6">
                  <TabsList className="grid w-full grid-cols-4">
                    <TabsTrigger value="tone">Tone</TabsTrigger>
                    <TabsTrigger value="style">Style</TabsTrigger>
                    <TabsTrigger value="guidelines">Guidelines</TabsTrigger>
                    <TabsTrigger value="vocabulary">Vocabulary</TabsTrigger>
                  </TabsList>

                  <TabsContent value="tone" className="space-y-6">
                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="space-y-2">
                        <Label htmlFor="name">Profile Name</Label>
                        <Input
                          id="name"
                          value={name}
                          onChange={(e) => setName(e.target.value)}
                          placeholder="e.g., Marketing Voice"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="description">Description</Label>
                        <Input
                          id="description"
                          value={description}
                          onChange={(e) => setDescription(e.target.value)}
                          placeholder="Brief description of this voice"
                        />
                      </div>
                    </div>

                    <div className="space-y-4">
                      <Label>Tone Settings</Label>
                      <ToneSelector
                        value={toneSettings}
                        onChange={setToneSettings}
                        disabled={isPending}
                      />
                    </div>
                  </TabsContent>

                  <TabsContent value="style" className="space-y-6">
                    <div className="space-y-4">
                      <Label>Writing Style</Label>
                      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                        {WRITING_STYLES.map((style) => (
                          <button
                            key={style.value}
                            onClick={() => setWritingStyle(style.value)}
                            className={`rounded-lg border p-4 text-left transition-colors hover:bg-accent ${
                              writingStyle === style.value ? 'border-primary bg-primary/5' : ''
                            }`}
                          >
                            <p className="font-medium">{style.label}</p>
                            <p className="text-xs text-muted-foreground">{style.description}</p>
                          </button>
                        ))}
                      </div>
                    </div>
                  </TabsContent>

                  <TabsContent value="guidelines" className="space-y-6">
                    <BrandGuidelines
                      dos={dos}
                      donts={donts}
                      onDosChange={setDos}
                      onDontsChange={setDonts}
                      disabled={isPending}
                    />
                  </TabsContent>

                  <TabsContent value="vocabulary" className="space-y-6">
                    <div className="grid gap-6 md:grid-cols-2">
                      <div className="space-y-4">
                        <Label>Preferred Words & Phrases</Label>
                        <Textarea
                          value={vocabularyPreferences.join('\n')}
                          onChange={(e) =>
                            setVocabularyPreferences(
                              e.target.value.split('\n').filter((w) => w.trim())
                            )
                          }
                          placeholder="Enter words/phrases (one per line)"
                          rows={6}
                        />
                        <p className="text-xs text-muted-foreground">
                          Words and phrases to prefer in generated content
                        </p>
                      </div>
                      <div className="space-y-4">
                        <Label>Words to Avoid</Label>
                        <Textarea
                          value={wordsToAvoid.join('\n')}
                          onChange={(e) =>
                            setWordsToAvoid(
                              e.target.value.split('\n').filter((w) => w.trim())
                            )
                          }
                          placeholder="Enter words to avoid (one per line)"
                          rows={6}
                        />
                        <p className="text-xs text-muted-foreground">
                          Words and phrases to avoid in generated content
                        </p>
                      </div>
                    </div>
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>

            {/* Live Preview */}
            <VoicePreview
              toneSettings={toneSettings}
              writingStyle={writingStyle}
              dos={dos}
              donts={donts}
              vocabularyPreferences={vocabularyPreferences}
              wordsToAvoid={wordsToAvoid}
            />
          </>
        ) : (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <p className="text-lg font-medium mb-2">No Profile Selected</p>
              <p className="text-sm text-muted-foreground mb-4">
                Select a profile from the list or create a new one.
              </p>
              <Button onClick={() => setShowNewDialog(true)}>
                <Plus className="mr-2 h-4 w-4" />
                Create Voice Profile
              </Button>
            </CardContent>
          </Card>
        )}
      </div>

      {/* New Profile Dialog */}
      <Dialog open={showNewDialog} onOpenChange={setShowNewDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Voice Profile</DialogTitle>
            <DialogDescription>
              Create a new brand voice profile for one of your products.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="new-product">Product</Label>
              <Select value={newProductId} onValueChange={setNewProductId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a product" />
                </SelectTrigger>
                <SelectContent>
                  {products.map((product) => (
                    <SelectItem key={product.id} value={product.id}>
                      {product.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="new-name">Profile Name</Label>
              <Input
                id="new-name"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="e.g., Marketing Voice, Technical Docs"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNewDialog(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleCreateProfile}
              disabled={!newName.trim() || !newProductId || isPending}
            >
              {isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Plus className="mr-2 h-4 w-4" />
              )}
              Create Profile
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
