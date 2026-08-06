"use client";

import {
  BarcodeFormat,
  BrowserMultiFormatReader,
  type IScannerControls,
} from "@zxing/browser";
import {
  Braces,
  Camera,
  Check,
  Copy,
  Database,
  Download,
  FileSpreadsheet,
  Keyboard,
  Lightbulb,
  LightbulbOff,
  ScanLine,
  Search,
  ShieldCheck,
  Trash2,
  Volume2,
  VolumeX,
  X,
} from "lucide-react";
import type { FormEvent } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

const STORAGE_KEY = "liansao.scans.v1";
const SETTINGS_KEY = "liansao.settings.v1";
const DUPLICATE_COOLDOWN_MS = 1800;

type ScannerStatus = "idle" | "starting" | "scanning" | "error";

type ScanRecord = {
  id: string;
  value: string;
  format: string;
  scannedAt: string;
  source: "camera" | "manual";
};

const formatNames: Record<string, string> = {
  AZTEC: "AZTEC",
  CODABAR: "CODABAR",
  CODE_39: "CODE 39",
  CODE_93: "CODE 93",
  CODE_128: "CODE 128",
  DATA_MATRIX: "DATA MATRIX",
  EAN_8: "EAN-8",
  EAN_13: "EAN-13",
  ITF: "ITF",
  MAXICODE: "MAXICODE",
  PDF_417: "PDF417",
  QR_CODE: "QR CODE",
  RSS_14: "RSS-14",
  RSS_EXPANDED: "RSS EXPANDED",
  UPC_A: "UPC-A",
  UPC_E: "UPC-E",
  UPC_EAN_EXTENSION: "UPC/EAN EXT",
  MANUAL: "手动录入",
};

function createId() {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function normalizeFormat(format: string) {
  return formatNames[format] ?? format.replaceAll("_", " ");
}

function downloadBlob(content: string, type: string, filename: string) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function safeCsvCell(value: string) {
  const protectedValue = /^[=+\-@]/.test(value) ? `'${value}` : value;
  return `"${protectedValue.replaceAll('"', '""')}"`;
}

function friendlyCameraError(error: unknown) {
  if (error instanceof DOMException) {
    if (error.name === "NotAllowedError") {
      return "相机权限未开启，请在浏览器设置中允许访问相机。";
    }
    if (error.name === "NotFoundError") {
      return "没有找到可用的相机。你仍可使用下方的手动录入。";
    }
    if (error.name === "NotReadableError") {
      return "相机正被其他应用占用，请关闭后重试。";
    }
  }
  return "暂时无法启动相机，请检查权限或换一个浏览器重试。";
}

export default function Home() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const controlsRef = useRef<IScannerControls | null>(null);
  const readerRef = useRef<BrowserMultiFormatReader | null>(null);
  const recentScansRef = useRef(new Map<string, number>());
  const feedbackRef = useRef({ sound: true, vibration: true });

  const [records, setRecords] = useState<ScanRecord[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const [status, setStatus] = useState<ScannerStatus>("idle");
  const [cameraError, setCameraError] = useState("");
  const [query, setQuery] = useState("");
  const [manualValue, setManualValue] = useState("");
  const [lastScan, setLastScan] = useState<ScanRecord | null>(null);
  const [toast, setToast] = useState("");
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [soundOn, setSoundOn] = useState(true);
  const [vibrationOn, setVibrationOn] = useState(true);
  const [torchOn, setTorchOn] = useState(false);
  const [torchAvailable, setTorchAvailable] = useState(false);

  useEffect(() => {
    try {
      const storedRecords = window.localStorage.getItem(STORAGE_KEY);
      if (storedRecords) {
        const parsed = JSON.parse(storedRecords) as ScanRecord[];
        if (Array.isArray(parsed)) setRecords(parsed);
      }

      const storedSettings = window.localStorage.getItem(SETTINGS_KEY);
      if (storedSettings) {
        const parsed = JSON.parse(storedSettings) as {
          sound?: boolean;
          vibration?: boolean;
        };
        setSoundOn(parsed.sound ?? true);
        setVibrationOn(parsed.vibration ?? true);
      }
    } catch {
      setToast("本地记录读取失败，已为你开启一个新列表。");
    } finally {
      setHydrated(true);
    }
  }, []);

  useEffect(() => {
    feedbackRef.current = { sound: soundOn, vibration: vibrationOn };
    if (hydrated) {
      window.localStorage.setItem(
        SETTINGS_KEY,
        JSON.stringify({ sound: soundOn, vibration: vibrationOn }),
      );
    }
  }, [soundOn, vibrationOn, hydrated]);

  useEffect(() => {
    if (hydrated) {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
    }
  }, [records, hydrated]);

  useEffect(() => {
    if (!toast) return;
    const timeout = window.setTimeout(() => setToast(""), 2600);
    return () => window.clearTimeout(timeout);
  }, [toast]);

  const playFeedback = useCallback(() => {
    if (feedbackRef.current.vibration && "vibrate" in navigator) {
      navigator.vibrate(55);
    }

    if (feedbackRef.current.sound) {
      try {
        const AudioContextClass =
          window.AudioContext ||
          (window as typeof window & { webkitAudioContext?: typeof AudioContext })
            .webkitAudioContext;
        if (!AudioContextClass) return;
        const context = new AudioContextClass();
        const oscillator = context.createOscillator();
        const gain = context.createGain();
        oscillator.type = "sine";
        oscillator.frequency.setValueAtTime(880, context.currentTime);
        gain.gain.setValueAtTime(0.0001, context.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.12, context.currentTime + 0.01);
        gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + 0.12);
        oscillator.connect(gain);
        gain.connect(context.destination);
        oscillator.start();
        oscillator.stop(context.currentTime + 0.13);
        oscillator.addEventListener("ended", () => void context.close());
      } catch {
        // Audio feedback is optional and can be blocked by browser policy.
      }
    }
  }, []);

  const addRecord = useCallback(
    (value: string, format: string, source: ScanRecord["source"]) => {
      const trimmedValue = value.trim();
      if (!trimmedValue) return;

      const record: ScanRecord = {
        id: createId(),
        value: trimmedValue,
        format,
        scannedAt: new Date().toISOString(),
        source,
      };

      setRecords((current) => [record, ...current]);
      setLastScan(record);
      playFeedback();
      window.setTimeout(
        () => setLastScan((current) => (current?.id === record.id ? null : current)),
        1500,
      );
    },
    [playFeedback],
  );

  const stopScanner = useCallback(() => {
    controlsRef.current?.stop();
    controlsRef.current = null;
    readerRef.current = null;
    setTorchOn(false);
    setTorchAvailable(false);
    setStatus("idle");
  }, []);

  useEffect(() => () => controlsRef.current?.stop(), []);

  const startScanner = useCallback(async () => {
    if (status === "starting" || status === "scanning") return;

    setCameraError("");
    setStatus("starting");

    if (!window.isSecureContext && window.location.hostname !== "localhost") {
      setCameraError("相机需要通过安全连接打开。请使用已发布的网址。 ");
      setStatus("error");
      return;
    }

    try {
      const reader = new BrowserMultiFormatReader(undefined, {
        delayBetweenScanAttempts: 120,
        delayBetweenScanSuccess: 250,
      });
      readerRef.current = reader;

      const controls = await reader.decodeFromConstraints(
        {
          audio: false,
          video: {
            facingMode: { ideal: "environment" },
            width: { ideal: 1920 },
            height: { ideal: 1080 },
          },
        },
        videoRef.current ?? undefined,
        (result) => {
          if (!result) return;

          const value = result.getText();
          const now = Date.now();
          const previous = recentScansRef.current.get(value) ?? 0;
          if (now - previous < DUPLICATE_COOLDOWN_MS) return;

          recentScansRef.current.set(value, now);
          for (const [key, timestamp] of recentScansRef.current) {
            if (now - timestamp > 10_000) recentScansRef.current.delete(key);
          }

          const formatKey = BarcodeFormat[result.getBarcodeFormat()] ?? "UNKNOWN";
          addRecord(value, formatKey, "camera");
        },
      );

      controlsRef.current = controls;
      setTorchAvailable(Boolean(controls.switchTorch));
      setStatus("scanning");
    } catch (error) {
      controlsRef.current?.stop();
      controlsRef.current = null;
      setCameraError(friendlyCameraError(error));
      setStatus("error");
    }
  }, [addRecord, status]);

  const toggleTorch = async () => {
    const next = !torchOn;
    try {
      await controlsRef.current?.switchTorch?.(next);
      setTorchOn(next);
    } catch {
      setTorchAvailable(false);
      setToast("当前设备暂不支持网页手电筒控制。");
    }
  };

  const submitManual = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!manualValue.trim()) return;
    addRecord(manualValue, "MANUAL", "manual");
    setManualValue("");
  };

  const filteredRecords = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase("zh-CN");
    if (!normalizedQuery) return records;
    return records.filter(
      (record) =>
        record.value.toLocaleLowerCase("zh-CN").includes(normalizedQuery) ||
        normalizeFormat(record.format)
          .toLocaleLowerCase("zh-CN")
          .includes(normalizedQuery),
    );
  }, [query, records]);

  const todayCount = useMemo(() => {
    const today = new Date().toDateString();
    return records.filter(
      (record) => new Date(record.scannedAt).toDateString() === today,
    ).length;
  }, [records]);

  const uniqueCount = useMemo(
    () => new Set(records.map((record) => record.value)).size,
    [records],
  );

  const exportCsv = () => {
    const rows = [...records].reverse().map((record, index) =>
      [
        String(index + 1),
        record.value,
        normalizeFormat(record.format),
        new Date(record.scannedAt).toLocaleString("zh-CN", { hour12: false }),
        record.source === "camera" ? "相机" : "手动",
      ]
        .map(safeCsvCell)
        .join(","),
    );
    const header = ["序号", "条码内容", "格式", "扫描时间", "来源"]
      .map(safeCsvCell)
      .join(",");
    downloadBlob(
      `\uFEFF${[header, ...rows].join("\r\n")}`,
      "text/csv;charset=utf-8",
      `连扫-${new Date().toISOString().slice(0, 10)}.csv`,
    );
    setToast(`已导出 ${records.length} 条 CSV 记录。`);
  };

  const exportJson = () => {
    downloadBlob(
      JSON.stringify([...records].reverse(), null, 2),
      "application/json;charset=utf-8",
      `连扫-${new Date().toISOString().slice(0, 10)}.json`,
    );
    setToast(`已导出 ${records.length} 条 JSON 记录。`);
  };

  const copyValue = async (record: ScanRecord) => {
    try {
      await navigator.clipboard.writeText(record.value);
      setCopiedId(record.id);
      window.setTimeout(() => setCopiedId(null), 1300);
    } catch {
      setToast("复制失败，请长按条码内容复制。");
    }
  };

  const clearRecords = () => {
    if (!records.length) return;
    if (window.confirm(`确定清空全部 ${records.length} 条记录吗？此操作无法撤销。`)) {
      setRecords([]);
      setToast("记录已清空。");
    }
  };

  const statusText = {
    idle: "等待开始",
    starting: "正在连接相机",
    scanning: "连续扫描中",
    error: "相机未连接",
  }[status];

  return (
    <main className="app-shell">
      <header className="topbar">
        <a className="brand" href="#top" aria-label="连扫首页">
          <span className="brand-mark" aria-hidden="true">
            <i />
            <i />
            <i />
            <i />
          </span>
          <span>连扫</span>
        </a>
        <div className="local-badge">
          <ShieldCheck size={15} strokeWidth={2.2} />
          仅存此设备
        </div>
      </header>

      <section className="intro" id="top">
        <div>
          <p className="eyebrow">连续条码采集工作台</p>
          <h1>把条码，<span>连续收进来。</span></h1>
          <p className="intro-copy">
            扫描后自动保存并立即准备下一次。无需登录，数据不会离开这台设备。
          </p>
        </div>
        <div className="stats" aria-label="扫描统计">
          <div><strong>{records.length}</strong><span>全部记录</span></div>
          <div><strong>{todayCount}</strong><span>今日扫描</span></div>
          <div><strong>{uniqueCount}</strong><span>唯一条码</span></div>
        </div>
      </section>

      <section className="workspace" aria-label="条码扫描工作台">
        <div className="scanner-panel">
          <div className="panel-heading scanner-heading">
            <div>
              <p className="panel-kicker">01 / 扫描</p>
              <h2>取景器</h2>
            </div>
            <span className={`status-pill status-${status}`}>
              <i aria-hidden="true" />
              {statusText}
            </span>
          </div>

          <div className={`camera-stage ${status === "scanning" ? "is-live" : ""}`}>
            <video ref={videoRef} muted playsInline aria-label="相机实时画面" />
            {status !== "scanning" && status !== "starting" && (
              <div className="camera-placeholder">
                <div className="placeholder-barcode" aria-hidden="true">
                  {Array.from({ length: 18 }, (_, index) => <i key={index} />)}
                </div>
                <p>将条码置于取景框内</p>
                <span>支持常见一维码与二维码</span>
              </div>
            )}
            {status === "starting" && (
              <div className="camera-placeholder connecting">
                <span className="spinner" aria-hidden="true" />
                <p>正在唤醒相机…</p>
              </div>
            )}
            <div className="scan-frame" aria-hidden="true">
              <i /><i /><i /><i />
              {status === "scanning" && <b />}
            </div>
            {lastScan && (
              <div className="capture-confirmation" role="status">
                <Check size={18} strokeWidth={3} />
                <span>已保存</span>
                <strong>{lastScan.value}</strong>
              </div>
            )}
          </div>

          {cameraError && (
            <div className="camera-error" role="alert">
              <X size={17} />
              <span>{cameraError}</span>
            </div>
          )}

          <div className="scanner-actions">
            {status === "scanning" ? (
              <button className="primary-button stop-button" type="button" onClick={stopScanner}>
                <X size={19} />
                停止扫描
              </button>
            ) : (
              <button className="primary-button" type="button" onClick={startScanner} disabled={status === "starting"}>
                <Camera size={19} />
                {status === "starting" ? "正在启动" : "开始连续扫描"}
              </button>
            )}
            <button
              className="icon-button"
              type="button"
              onClick={toggleTorch}
              disabled={!torchAvailable || status !== "scanning"}
              aria-label={torchOn ? "关闭手电筒" : "打开手电筒"}
              title={torchAvailable ? "手电筒" : "当前设备不支持手电筒控制"}
            >
              {torchOn ? <Lightbulb size={20} /> : <LightbulbOff size={20} />}
            </button>
            <button
              className="icon-button"
              type="button"
              onClick={() => setSoundOn((current) => !current)}
              aria-label={soundOn ? "关闭提示音" : "开启提示音"}
              title={soundOn ? "关闭提示音" : "开启提示音"}
            >
              {soundOn ? <Volume2 size={20} /> : <VolumeX size={20} />}
            </button>
          </div>

          <div className="feedback-row">
            <button
              type="button"
              className={vibrationOn ? "is-on" : ""}
              onClick={() => setVibrationOn((current) => !current)}
              aria-pressed={vibrationOn}
            >
              <span aria-hidden="true" />
              震动反馈
            </button>
            <p><Database size={14} /> 每次扫描都会自动本地保存</p>
          </div>

          <form className="manual-entry" onSubmit={submitManual}>
            <label htmlFor="manual-code"><Keyboard size={16} /> 手动录入</label>
            <div>
              <input
                id="manual-code"
                value={manualValue}
                onChange={(event) => setManualValue(event.target.value)}
                placeholder="输入条码后按回车"
                autoComplete="off"
                spellCheck={false}
              />
              <button type="submit" disabled={!manualValue.trim()}>添加</button>
            </div>
          </form>
        </div>

        <div className="records-panel">
          <div className="panel-heading records-heading">
            <div>
              <p className="panel-kicker">02 / 记录</p>
              <h2>扫描清单 <span>{records.length}</span></h2>
            </div>
            <button
              className="clear-button"
              type="button"
              onClick={clearRecords}
              disabled={!records.length}
            >
              <Trash2 size={15} /> 清空
            </button>
          </div>

          <div className="record-tools">
            <label className="search-box">
              <Search size={17} />
              <span className="sr-only">搜索记录</span>
              <input
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="搜索条码或格式"
              />
              {query && (
                <button type="button" onClick={() => setQuery("")} aria-label="清除搜索">
                  <X size={15} />
                </button>
              )}
            </label>
            <div className="export-actions">
              <button type="button" onClick={exportCsv} disabled={!records.length}>
                <FileSpreadsheet size={16} /> CSV
              </button>
              <button type="button" onClick={exportJson} disabled={!records.length}>
                <Braces size={16} /> JSON
              </button>
            </div>
          </div>

          <div className="records-list" aria-live="polite">
            {!hydrated ? (
              <div className="empty-state"><span className="spinner dark" /><p>正在读取本地记录…</p></div>
            ) : filteredRecords.length ? (
              filteredRecords.map((record, index) => (
                <article className="record-row" key={record.id}>
                  <span className="record-number">{String(filteredRecords.length - index).padStart(2, "0")}</span>
                  <div className="record-main">
                    <div className="record-value-line">
                      <button type="button" onClick={() => copyValue(record)} title="复制条码">
                        <strong>{record.value}</strong>
                        {copiedId === record.id ? <Check size={14} /> : <Copy size={14} />}
                      </button>
                    </div>
                    <div className="record-meta">
                      <span>{normalizeFormat(record.format)}</span>
                      <time dateTime={record.scannedAt}>
                        {new Date(record.scannedAt).toLocaleString("zh-CN", {
                          month: "2-digit",
                          day: "2-digit",
                          hour: "2-digit",
                          minute: "2-digit",
                          second: "2-digit",
                          hour12: false,
                        })}
                      </time>
                    </div>
                  </div>
                  <button
                    className="delete-record"
                    type="button"
                    onClick={() => setRecords((current) => current.filter((item) => item.id !== record.id))}
                    aria-label={`删除条码 ${record.value}`}
                  >
                    <Trash2 size={16} />
                  </button>
                </article>
              ))
            ) : (
              <div className="empty-state">
                <span className="empty-icon"><ScanLine size={27} /></span>
                <h3>{query ? "没有匹配的记录" : "第一条记录会出现在这里"}</h3>
                <p>{query ? "换个关键词试试。" : "启动相机连续扫描，或从左侧手动录入。"}</p>
              </div>
            )}
          </div>

          <div className="export-note">
            <Download size={16} />
            <p><strong>随时带走数据</strong><span>CSV 可直接用 Excel 打开，JSON 适合系统导入。</span></p>
          </div>
        </div>
      </section>

      <footer>
        <p><ShieldCheck size={15} /> 隐私优先：相机画面与扫描记录均不会上传。</p>
        <span>连扫 · Local-first barcode capture</span>
      </footer>

      {toast && <div className="toast" role="status">{toast}</div>}
    </main>
  );
}
