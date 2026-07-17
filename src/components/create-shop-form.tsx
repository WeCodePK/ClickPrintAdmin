"use client";

import { type FormEvent, useEffect, useState } from "react";
import { useAuth } from "@/components/auth-provider";
import type { CreateShopResponse, Shop } from "@/lib/types";

type FieldErrors = Partial<
  Record<
    | "name"
    | "address"
    | "latitude"
    | "longitude"
    | "imageUrl"
    | "timings"
    | "walletNumber"
    | "owner"
    | "capabilities",
    string
  >
>;

type FormState = {
  name: string;
  address: string;
  latitude: string;
  longitude: string;
  imageUrl: string;
  timings: string;
  walletNumber: string;
  capabilities: string;
  owner: string;
};

const emptyForm: FormState = {
  name: "",
  address: "",
  latitude: "",
  longitude: "",
  imageUrl: "",
  timings: "",
  walletNumber: "",
  capabilities: "",
  owner: "",
};

export function CreateShopForm({
  onCreated,
}: {
  onCreated?: (shop: Shop) => void;
}) {
  const { token, user } = useAuth();
  const [form, setForm] = useState(emptyForm);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [message, setMessage] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (user?._id) {
      setForm((prev) => (prev.owner ? prev : { ...prev, owner: user._id }));
    }
  }, [user]);

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setErrors({});
    setMessage(null);
    setIsSuccess(false);

    const lat = Number(form.latitude);
    const lng = Number(form.longitude);
    const nextErrors: FieldErrors = {};

    if (!form.name.trim()) nextErrors.name = "Name is required";
    if (!form.address.trim()) nextErrors.address = "Address is required";
    if (!Number.isFinite(lat)) nextErrors.latitude = "Valid latitude required";
    if (!Number.isFinite(lng)) nextErrors.longitude = "Valid longitude required";
    if (!form.imageUrl.trim()) nextErrors.imageUrl = "Image URL is required";
    if (!form.timings.trim()) nextErrors.timings = "At least one timing required";
    if (!form.walletNumber.trim()) {
      nextErrors.walletNumber = "Wallet number is required";
    }
    if (!form.owner.trim()) nextErrors.owner = "Owner id is required";

    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      setMessage("Validation failed");
      setIsSubmitting(false);
      return;
    }

    const payload = {
      name: form.name.trim(),
      address: form.address.trim(),
      coordinates: [lat, lng] as [number, number],
      imageUrl: form.imageUrl.trim(),
      timings: form.timings
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean),
      walletNumber: form.walletNumber.trim(),
      capabilities: form.capabilities
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean),
      owner: form.owner.trim(),
    };

    try {
      const response = await fetch("/api/shops", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(payload),
      });

      const data = (await response.json()) as CreateShopResponse & {
        error?: string;
        details?: FieldErrors;
      };

      if (!response.ok || data.success === false) {
        setErrors(data.details ?? {});
        setMessage(data.error ?? data.message ?? "Failed to create shop");
        return;
      }

      const shop = data.data?.shop;
      setForm({
        ...emptyForm,
        owner: user?._id ?? "",
      });
      setIsSuccess(true);
      const disabledNote =
        shop?.isDisabled === true
          ? " It was created as disabled, so it may not appear in All shops until enabled."
          : "";
      setMessage(
        (data.message ?? `Shop "${shop?.name}" created`) + disabledNote,
      );
      if (shop) onCreated?.(shop);
    } catch {
      setMessage("Network error while creating shop");
    } finally {
      setIsSubmitting(false);
    }
  }

  const inputClass =
    "mt-1.5 w-full rounded-lg border border-border bg-surface px-3 py-2.5 text-sm outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/20";

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-2xl border border-border bg-surface p-6 shadow-sm"
    >
      <div className="mb-6">
        <h2 className="font-[family-name:var(--font-display)] text-xl tracking-tight">
          Shop details
        </h2>
        <p className="mt-1 text-sm text-muted">
          Fill in location, wallet, and operating hours.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block sm:col-span-2">
          <span className="text-sm font-medium">Shop name</span>
          <input
            className={inputClass}
            value={form.name}
            onChange={(e) => update("name", e.target.value)}
            placeholder="Raja Jani Pan Shop"
            required
          />
          {errors.name ? (
            <span className="mt-1 block text-xs text-danger">{errors.name}</span>
          ) : null}
        </label>

        <label className="block sm:col-span-2">
          <span className="text-sm font-medium">Address</span>
          <input
            className={inputClass}
            value={form.address}
            onChange={(e) => update("address", e.target.value)}
            placeholder="Dhok Syedan, Rawalpindi"
            required
          />
          {errors.address ? (
            <span className="mt-1 block text-xs text-danger">{errors.address}</span>
          ) : null}
        </label>

        <label className="block">
          <span className="text-sm font-medium">Latitude</span>
          <input
            className={inputClass}
            value={form.latitude}
            onChange={(e) => update("latitude", e.target.value)}
            placeholder="33.62314"
            inputMode="decimal"
            required
          />
          {errors.latitude ? (
            <span className="mt-1 block text-xs text-danger">
              {errors.latitude}
            </span>
          ) : null}
        </label>

        <label className="block">
          <span className="text-sm font-medium">Longitude</span>
          <input
            className={inputClass}
            value={form.longitude}
            onChange={(e) => update("longitude", e.target.value)}
            placeholder="72.94993"
            inputMode="decimal"
            required
          />
          {errors.longitude ? (
            <span className="mt-1 block text-xs text-danger">
              {errors.longitude}
            </span>
          ) : null}
        </label>

        <label className="block sm:col-span-2">
          <span className="text-sm font-medium">Image URL</span>
          <input
            className={inputClass}
            value={form.imageUrl}
            onChange={(e) => update("imageUrl", e.target.value)}
            placeholder="https://..."
            required
          />
          {errors.imageUrl ? (
            <span className="mt-1 block text-xs text-danger">
              {errors.imageUrl}
            </span>
          ) : null}
        </label>

        <label className="block sm:col-span-2">
          <span className="text-sm font-medium">Timings</span>
          <textarea
            className={inputClass}
            rows={3}
            value={form.timings}
            onChange={(e) => update("timings", e.target.value)}
            placeholder={"Mon-Fri: 08:30 - 05:30\nSat: 09:00 - 02:00"}
            required
          />
          <span className="mt-1 block text-xs text-muted">
            One timing per line
          </span>
          {errors.timings ? (
            <span className="mt-1 block text-xs text-danger">{errors.timings}</span>
          ) : null}
        </label>

        <label className="block">
          <span className="text-sm font-medium">Wallet number</span>
          <input
            className={inputClass}
            value={form.walletNumber}
            onChange={(e) => update("walletNumber", e.target.value)}
            placeholder="03235400291"
            required
          />
          {errors.walletNumber ? (
            <span className="mt-1 block text-xs text-danger">
              {errors.walletNumber}
            </span>
          ) : null}
        </label>

        <label className="block">
          <span className="text-sm font-medium">Owner id</span>
          <input
            className={inputClass}
            value={form.owner}
            onChange={(e) => update("owner", e.target.value)}
            placeholder="6a513bec6c5b3d6712b70276"
            required
          />
          {errors.owner ? (
            <span className="mt-1 block text-xs text-danger">{errors.owner}</span>
          ) : null}
        </label>

        <label className="block sm:col-span-2">
          <span className="text-sm font-medium">Capabilities (optional)</span>
          <input
            className={inputClass}
            value={form.capabilities}
            onChange={(e) => update("capabilities", e.target.value)}
            placeholder="Comma-separated, leave empty for []"
          />
          {errors.capabilities ? (
            <span className="mt-1 block text-xs text-danger">
              {errors.capabilities}
            </span>
          ) : null}
        </label>
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={isSubmitting}
          className="px-4 py-2 bg-accent text-white rounded-lg text-sm font-medium hover:bg-accent-hover transition disabled:opacity-50"
        >
          {isSubmitting ? "Creating…" : "Create shop"}
        </button>
        {message ? (
          <p className={`text-sm ${isSuccess ? "text-accent" : "text-danger"}`}>
            {message}
          </p>
        ) : null}
      </div>
    </form>
  );
}
