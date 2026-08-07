"use client";

import { ExternalLink, Globe2, HardDrive, Info, QrCode } from "lucide-react";
import { useMemo, useSyncExternalStore } from "react";
import { FaGithub } from "react-icons/fa6";
import { renderSVG } from "uqr";
import { BUILD_NUMBER } from "../build-version";

const subscribeToLocation = () => () => {};
const getServerAppUrl = () => "";
const getCurrentAppUrl = () => {
  const currentUrl = new URL(window.location.href);
  currentUrl.hash = "";
  currentUrl.search = "";
  return currentUrl.toString();
};

export function SettingsAbout() {
  const appUrl = useSyncExternalStore(subscribeToLocation, getCurrentAppUrl, getServerAppUrl);

  const qrImageUrl = useMemo(() => {
    if (!appUrl) return "";
    const svg = renderSVG(appUrl, {
      ecc: "M",
      border: 3,
      pixelSize: 5,
      blackColor: "#171916",
      whiteColor: "#ffffff",
    });
    return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  }, [appUrl]);

  return (
    <section className="settings-about" aria-labelledby="settings-about-title">
      <div className="settings-about-heading">
        <span className="settings-about-icon" aria-hidden="true"><Info size={19} /></span>
        <div>
          <p className="panel-kicker">About</p>
          <h3 id="settings-about-title">ScanFlow</h3>
          <p>Continuous barcode capture with project-based, local-first storage.</p>
        </div>
        <span className="settings-about-build">Build {BUILD_NUMBER}</span>
      </div>

      <div className="settings-about-details">
        <div className="settings-about-detail">
          <HardDrive size={17} aria-hidden="true" />
          <span><strong>Storage</strong><small>This browser only</small></span>
        </div>
        <a
          className="settings-about-detail"
          href="https://github.com/ipangbo/scanflow-barcode-capture"
          target="_blank"
          rel="noreferrer"
        >
          <FaGithub size={17} aria-hidden="true" />
          <span><strong>Source</strong><small>GitHub</small></span>
          <ExternalLink size={13} aria-hidden="true" />
        </a>
      </div>

      <div className="settings-about-share">
        <div className="settings-about-address">
          <p><Globe2 size={15} aria-hidden="true" /> Current app address</p>
          {appUrl ? (
            <a href={appUrl} target="_blank" rel="noreferrer">{appUrl}</a>
          ) : (
            <span>Reading current address…</span>
          )}
          <small>Scan to open this exact address. The QR code follows the domain currently shown in your browser.</small>
        </div>
        <figure className="settings-about-qr">
          <div className="settings-about-qr-frame">
            {qrImageUrl ? (
              // The QR code is generated locally as a data URI, so image optimization cannot improve it.
              // eslint-disable-next-line @next/next/no-img-element
              <img src={qrImageUrl} alt={`QR code for ${appUrl}`} />
            ) : (
              <QrCode size={42} aria-hidden="true" />
            )}
          </div>
          <figcaption>Scan to open</figcaption>
        </figure>
      </div>
    </section>
  );
}
