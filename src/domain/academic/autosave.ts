export class SaveVersionTracker {
  private readonly versions = new Map<string, number>();

  next(key: string) {
    const version = (this.versions.get(key) ?? 0) + 1;
    this.versions.set(key, version);
    return version;
  }

  current(key: string) {
    return this.versions.get(key);
  }

  isCurrent(key: string, version: number) {
    return this.current(key) === version;
  }
}
