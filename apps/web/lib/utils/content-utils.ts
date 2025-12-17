export type AssetType =
  | 'blog_post'
  | 'landing_page'
  | 'email_template'
  | 'social_post'
  | 'image'
  | 'document';

/**
 * Get asset type display name
 */
export function getAssetTypeDisplayName(type: AssetType): string {
  const names: Record<AssetType, string> = {
    blog_post: 'Blog Post',
    landing_page: 'Landing Page',
    email_template: 'Email Template',
    social_post: 'Social Post',
    image: 'Image',
    document: 'Document',
  };
  return names[type] || type;
}
