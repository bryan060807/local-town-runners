export function safeAssetUrl(
  value: unknown,
  projectUrl: string,
): string | undefined {
  if (typeof value !== "string") return;
  try {
    const url = new URL(value),
      project = new URL(projectUrl);
    if (
      url.origin !== project.origin ||
      url.username ||
      url.password ||
      !/^\/storage\/v1\/object\/public\/marketplace-assets\/(vendor|runner)\/[0-9a-f-]{36}\/[0-9a-f-]{36}\.webp$/.test(
        url.pathname,
      )
    )
      return;
    return url.toString();
  } catch {
    return;
  }
}
