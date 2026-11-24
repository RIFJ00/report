# HTML Viewer integration plan (2026-11-24)

## Agreed URL structure

- Existing main site: https://report.rifj.jp/ (must remain unchanged)
- Ministry article viewer: https://report.rifj.jp/html-viewer/
- Article detail: https://report.rifj.jp/html-viewer/{articleId}
- Article admin (proposed): https://report.rifj.jp/html-admin/
- Columns/blog (proposed): https://report.rifj.jp/columns/
- Existing routes (including /xpost/, /blog/, /admin/) must be preserved.

## Deployment safety rules

1. Do not replace the existing site's root `index.html` or globally rewrite all routes to the new viewer.
2. Inventory the **actual** Hosting project, site ID, deployment workflow, and custom-domain mapping before any production deploy.
3. Note: this repository has a CNAME file pointing to report.rifj.jp, but that alone does not prove the current production hosting provider. Confirm through Firebase Console, DNS, and deployment configuration.
4. Keep the viewer source in its own repository (planned `rifj-firebase-html`) if available; this repository should receive only a reviewed build artifact under `html-viewer/` if static-folder integration is chosen.
5. Firebase Hosting has one release per site; a second independent deploy to the same site can replace the full deployed file set. Use a unified build/deploy or a deliberately configured reverse-proxy approach. Do not assume a standalone Firebase deploy will preserve existing routes.
6. Ensure protected admin endpoints enforce authentication and Firestore/Storage security rules, not merely UI-side gating.
7. First test on a preview channel or staging Hosting site; check the root, /xpost/, /blog/, /html-viewer/, article detail routes, and admin access.
8. Only deploy to production after verifying a rollback path and preview approval.

## Article metadata minimum

- id, sourceUrl, sourceType, title, ministry, category, publishedAt (original source publication timestamp), fetchedAt, updatedAt, imageUrl, htmlContent or storagePath, status.
- Do not silently substitute fetch time for a known original publication time.
- If the source does not specify a publication date, apply the established uploader-date fallback and mark its provenance.

## Unresolved before implementation

- Confirm the actual Firebase project/site ID and relevant live hosting deployment source.
- Locate or create the `rifj-firebase-html` repository and obtain the latest URL-to-HTML generator/viewer source.
- Determine whether the current site build is itself on Firebase Hosting or if GitHub Pages is also part of the published path.
- Inspect existing authentication and Firestore collections to avoid incompatible migration.

This document is planning-only. No production configuration, article data or existing URLs were changed.
