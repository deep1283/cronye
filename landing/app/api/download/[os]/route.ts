import { NextResponse } from "next/server";

export const runtime = "nodejs";

type SupportedDownloadOS = "macos";

type ReleaseAsset = {
  id: number;
  name: string;
  content_type?: string;
};

type ReleaseResponse = {
  assets?: ReleaseAsset[];
};

const osAssetEnvKeys: Record<SupportedDownloadOS, string> = {
  macos: "GITHUB_RELEASE_ASSET_MACOS"
};

const defaultAssets: Record<SupportedDownloadOS, string> = {
  macos: "cronye-macos.dmg"
};

function resolveAssetName(os: SupportedDownloadOS): string {
  return process.env[osAssetEnvKeys[os]]?.trim() || defaultAssets[os];
}

function githubHeaders(token: string, accept: string): HeadersInit {
  return {
    Authorization: `Bearer ${token}`,
    Accept: accept,
    "X-GitHub-Api-Version": "2022-11-28",
    "User-Agent": "cronye-landing-download-proxy"
  };
}

export async function GET(
  _req: Request,
  context: { params: Promise<{ os: string }> }
) {
  const { os } = await context.params;
  if (os !== "macos") {
    return NextResponse.json({ error: "unsupported_os" }, { status: 404 });
  }

  const token = process.env.GITHUB_RELEASE_TOKEN?.trim();
  if (!token) {
    return NextResponse.json({ error: "github_release_token_missing" }, { status: 500 });
  }

  const owner = process.env.GITHUB_RELEASE_OWNER?.trim() || "deep1283";
  const repo = process.env.GITHUB_RELEASE_REPO?.trim() || "cronye";
  const tag = process.env.GITHUB_RELEASE_TAG?.trim() || "v0.1.5";
  const assetName = resolveAssetName(os as SupportedDownloadOS);

  const releaseURL = `https://api.github.com/repos/${owner}/${repo}/releases/tags/${encodeURIComponent(tag)}`;
  const releaseResp = await fetch(releaseURL, {
    headers: githubHeaders(token, "application/vnd.github+json"),
    cache: "no-store"
  });
  if (!releaseResp.ok) {
    return NextResponse.json(
      { error: `release_lookup_failed_${releaseResp.status}` },
      { status: 502 }
    );
  }

  const release = (await releaseResp.json()) as ReleaseResponse;
  const asset = release.assets?.find((item) => item.name === assetName);
  if (!asset) {
    return NextResponse.json({ error: "release_asset_not_found" }, { status: 404 });
  }

  const assetAPIURL = `https://api.github.com/repos/${owner}/${repo}/releases/assets/${asset.id}`;
  const assetResp = await fetch(assetAPIURL, {
    headers: githubHeaders(token, "application/octet-stream"),
    redirect: "follow",
    cache: "no-store"
  });
  if (!assetResp.ok || !assetResp.body) {
    return NextResponse.json(
      { error: `asset_download_failed_${assetResp.status}` },
      { status: 502 }
    );
  }

  return new Response(assetResp.body, {
    status: 200,
    headers: {
      "Content-Type": assetResp.headers.get("content-type") || asset.content_type || "application/octet-stream",
      "Content-Disposition": `attachment; filename=\"${asset.name}\"`,
      "Cache-Control": "private, max-age=300"
    }
  });
}
