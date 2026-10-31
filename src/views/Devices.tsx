import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Loader2,
  Monitor,
  RefreshCw,
  CheckCircle2,
  XCircle,
  Clock,
  WifiOff,
  AlertTriangle,
  CircleDashed,
} from "lucide-react";
import * as api from "../lib/tauri";
import type { DeviceTaskState } from "../lib/tauri";

/** Visual + label mapping for the seven task states (docs/devices.md).
 * "success" is always backed by the device's own receipt — never by the
 * mere existence of an instruction or a commit. */
function stateMeta(
  state: DeviceTaskState,
  t: (key: string) => string,
): {
  label: string;
  className: string;
  icon: typeof CheckCircle2;
} {
  switch (state) {
    case "success":
      return {
        label: t("devices.state.success"),
        className: "border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
        icon: CheckCircle2,
      };
    case "failed":
      return {
        label: t("devices.state.failed"),
        className: "border-red-500/30 bg-red-500/10 text-red-600 dark:text-red-400",
        icon: XCircle,
      };
    case "executing":
      return {
        label: t("devices.state.executing"),
        className: "border-blue-500/30 bg-blue-500/10 text-blue-600 dark:text-blue-400",
        icon: Loader2,
      };
    case "device_offline":
      return {
        label: t("devices.state.device_offline"),
        className: "border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400",
        icon: WifiOff,
      };
    case "stale":
      return {
        label: t("devices.state.stale"),
        className: "border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400",
        icon: AlertTriangle,
      };
    case "expired":
      return {
        label: t("devices.state.expired"),
        className: "border-border-subtle bg-surface text-muted",
        icon: Clock,
      };
    default:
      return {
        label: t("devices.state.pending"),
        className: "border-border-subtle bg-surface text-muted",
        icon: CircleDashed,
      };
  }
}

function StateBadge({ state }: { state: DeviceTaskState }) {
  const { t } = useTranslation();
  const meta = stateMeta(state, t);
  const Icon = meta.icon;
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] ${meta.className}`}
      data-state={state}
    >
      <Icon className={`h-3 w-3 ${state === "executing" ? "animate-spin" : ""}`} />
      {meta.label}
    </span>
  );
}

function formatTimestamp(ts: number | null, locale: string): string {
  if (!ts) return "";
  return new Date(ts * 1000).toLocaleString(locale);
}

export function Devices() {
  const { t, i18n } = useTranslation();
  const locale = i18n.language;

  const [page, setPage] = useState<api.DevicesPage | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      setPage(await api.devicesGetPage());
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const refresh = async () => {
    setRefreshing(true);
    setError(null);
    try {
      setPage(await api.devicesRefreshChannel());
    } catch (err) {
      setError(String(err));
    } finally {
      setRefreshing(false);
    }
  };

  const deviceName = (deviceId: string): string =>
    page?.devices.find((d) => d.id === deviceId)?.name ?? deviceId;

  return (
    <div className="app-page">
      <div className="app-page-header">
        <div>
          <h1 className="app-page-title">{t("devices.title")}</h1>
          <p className="app-page-subtitle">{t("devices.subtitle")}</p>
        </div>
        <button
          type="button"
          className="app-button-secondary inline-flex items-center gap-2"
          onClick={() => void refresh()}
          disabled={refreshing || !page?.channel.configured}
          data-testid="devices-refresh"
        >
          {refreshing ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <RefreshCw className="h-4 w-4" />
          )}
          {t("devices.refresh")}
        </button>
      </div>

      {error && (
        <div
          className="rounded-xl border border-red-500/25 bg-red-500/10 px-4 py-3 text-[13px] text-red-600 dark:text-red-400"
          data-testid="devices-error"
        >
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex items-center gap-2 p-6 text-[13px] text-muted">
          <Loader2 className="h-4 w-4 animate-spin" />
          {t("devices.loading")}
        </div>
      ) : !page ? null : !page.channel.configured ? (
        <div className="app-panel p-6 text-[13px] text-muted" data-testid="devices-not-configured">
          {t("devices.notConfigured")}
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          <div className="app-panel-muted flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3 text-[12px] text-muted">
            <span className="inline-flex items-center gap-1.5">
              <Monitor className="h-3.5 w-3.5" />
              {page.channel.url_redacted}
            </span>
            <span>{page.channel.branch}</span>
            <span>
              {t("devices.thisDevice")}: {page.channel.local_device_name} ({page.channel.local_device_id})
            </span>
          </div>

          {page.devices.length === 0 ? (
            <div className="app-panel p-6 text-[13px] text-muted" data-testid="devices-empty">
              {t("devices.noDevices")}
            </div>
          ) : (
            page.devices.map((device) => (
              <div key={device.id} className="app-panel p-4" data-testid={`device-${device.id}`}>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                  <span className="text-[14px] font-medium">{device.name}</span>
                  {device.platform && (
                    <span className="app-badge text-[11px]">{device.platform}</span>
                  )}
                  <span
                    className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] ${
                      device.online
                        ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                        : "border-border-subtle bg-surface-muted text-muted"
                    }`}
                    data-testid={`device-online-${device.online}`}
                  >
                    {device.online ? t("devices.online") : t("devices.offline")}
                  </span>
                  <span className="text-[12px] text-muted">
                    {device.last_seen_at
                      ? t("devices.lastSeen", {
                          time: formatTimestamp(device.last_seen_at, locale),
                        })
                      : t("devices.neverReported")}
                  </span>
                </div>

                {device.skill_records.length === 0 ? (
                  <p className="mt-3 text-[12px] text-muted">{t("devices.noSkillRecords")}</p>
                ) : (
                  <div className="mt-3 flex flex-col gap-2">
                    {Object.entries(
                      device.skill_records.reduce<Record<string, api.DeviceSkillRecord[]>>(
                        (acc, record) => {
                          (acc[record.agent_key] ??= []).push(record);
                          return acc;
                        },
                        {},
                      ),
                    ).map(([agentKey, records]) => (
                      <div key={agentKey} className="rounded-lg border border-border-subtle px-3 py-2">
                        <div className="text-[12px] font-medium">{agentKey}</div>
                        <ul className="mt-1 flex flex-col gap-0.5" aria-label={agentKey}>
                          {records.map((record) => (
                            <li
                              key={`${agentKey}:${record.skill_name}`}
                              className="flex flex-wrap items-center gap-x-2 text-[13px]"
                            >
                              <span>{record.skill_name}</span>
                              {record.deployed_at && (
                                <span className="text-[12px] text-muted">
                                  {formatTimestamp(record.deployed_at, locale)}
                                </span>
                              )}
                            </li>
                          ))}
                        </ul>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))
          )}

          <div className="app-panel p-4">
            <h2 className="app-section-title">{t("devices.instructionsTitle")}</h2>
            <p className="mb-3 text-[12px] text-muted">{t("devices.dataNotice")}</p>
            {page.instructions.length === 0 ? (
              <p className="text-[13px] text-muted" data-testid="instructions-empty">
                {t("devices.noInstructions")}
              </p>
            ) : (
              <ul className="flex flex-col gap-2" data-testid="instructions-list">
                {page.instructions.map((inst) => (
                  <li
                    key={inst.id}
                    className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border border-border-subtle px-3 py-2"
                    data-testid={`instruction-${inst.id}`}
                  >
                    <StateBadge state={inst.state} />
                    <span className="text-[13px] font-medium">
                      {inst.skill_name ?? inst.id}
                    </span>
                    <span className="app-badge text-[11px]">
                      {t(`devices.action.${inst.action}`)}
                    </span>
                    <span className="text-[12px] text-muted">{deviceName(inst.device_id)}</span>
                    <span className="text-[12px] text-muted">{inst.agent_key}</span>
                    {inst.receipt_detail && (
                      <span className="text-[12px] text-muted">{inst.receipt_detail}</span>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
