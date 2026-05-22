export type AccessUser = {
  authProvider?: "local" | "feishu";
  hasSofunnyKey?: boolean;
} | null;

export function isBrowseOnlyUser(user: AccessUser): boolean {
  return user?.authProvider === "feishu" && user?.hasSofunnyKey === false;
}

export function isBrowseOnlyPathAllowed(pathname: string): boolean {
  return (
    pathname === "/" ||
    pathname === "/setup/api-key" ||
    pathname.startsWith("/inspiration") ||
    pathname.startsWith("/tutorial") ||
    pathname === "/workflow/pet-traveler"
  );
}
