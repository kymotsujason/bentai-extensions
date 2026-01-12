/**
 * Base semantic version for all Bentai extensions.
 * Bumping this value will cascade to every extension which calls `getVersion()`.
 */
const BASE_VERSION = "1.0.0-alpha.1";

type NumericBumpOptions = {
    increaseMajor?: number;
    increaseMinor?: number;
    increasePatch?: number;
    /**
     * Override prerelease channel, defaults to the channel in BASE_VERSION (e.g., "alpha").
     */
    channel?: string;
    /**
     * Whether to reset the prerelease counter to 1 after a numeric bump.
     * Defaults to true to align with "v1.0.1-alpha.1" style increments.
     */
    resetPrerelease?: boolean;
};

type PrereleaseBumpOptions = {
    /**
     * Increase only the prerelease number (the `.N` after the channel).
     */
    increasePrerelease: number;
    channel?: string;
};

type ParsedVersion = {
    major: number;
    minor: number;
    patch: number;
    prerelease?: {
        channel: string;
        number: number;
    };
};

export function getVersion(
    options?: NumericBumpOptions | PrereleaseBumpOptions,
): string {
    if (!options) return BASE_VERSION;

    const parsed = parseVersion(BASE_VERSION);
    const hasNumericIncrement =
        "increasePrerelease" in options
            ? false
            : !!(
                  options.increaseMajor ||
                  options.increaseMinor ||
                  options.increasePatch
              );

    if ("increasePrerelease" in options) {
        if (!parsed.prerelease) {
            throw new Error(
                "Cannot increase prerelease: BASE_VERSION is a stable release.",
            );
        }

        const channel = options.channel ?? parsed.prerelease.channel;
        const newNumber = parsed.prerelease.number + options.increasePrerelease;

        return formatVersion(parsed.major, parsed.minor, parsed.patch, {
            channel,
            number: newNumber,
        });
    }

    if (!hasNumericIncrement) {
        throw new Error(
            "Empty options object provided. Specify a version increment or call getVersion() with no arguments.",
        );
    }

    const newMajor = parsed.major + (options.increaseMajor ?? 0);
    const newMinor = parsed.minor + (options.increaseMinor ?? 0);
    const newPatch = parsed.patch + (options.increasePatch ?? 0);

    // Reset prerelease to .1 by default when bumping numeric parts
    const channel =
        options.channel ??
        parsed.prerelease?.channel ??
        // default channel if BASE_VERSION was stable
        "alpha";
    const prereleaseNumber =
        options.resetPrerelease === false
            ? (parsed.prerelease?.number ?? 0)
            : 1;

    return formatVersion(newMajor, newMinor, newPatch, {
        channel,
        number: prereleaseNumber,
    });
}

function parseVersion(input: string): ParsedVersion {
    const match = input.match(
        /^(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z]+)\.(\d+))?$/,
    );

    if (!match) {
        throw new Error(
            `Invalid BASE_VERSION '${input}'. Expected 'vX.Y.Z-channel.N' or 'vX.Y.Z'.`,
        );
    }

    const [, major, minor, patch, channel, preNum] = match;
    const prerelease =
        channel && preNum ? { channel, number: Number(preNum) } : undefined;

    return {
        major: Number(major),
        minor: Number(minor),
        patch: Number(patch),
        prerelease,
    };
}

function formatVersion(
    major: number,
    minor: number,
    patch: number,
    prerelease?: { channel: string; number: number },
): string {
    const base = `${major}.${minor}.${patch}`;
    if (!prerelease) return base;
    return `${base}-${prerelease.channel}.${prerelease.number}`;
}
