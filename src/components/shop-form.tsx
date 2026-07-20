"use client";

import { type FormEvent, useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/auth-provider";
import type { CreateShopResponse, Shop, UploadFileResponse } from "@/lib/types";
import type { LatLng } from "@/components/location-picker";

// Leaflet touches `window` at import time, so it must never render on the server.
const LocationPicker = dynamic(
  () => import("@/components/location-picker").then((m) => m.LocationPicker),
  {
    ssr: false,
    loading: () => (
      <div className="h-72 w-full animate-pulse rounded-lg border border-border bg-surface-muted" />
    ),
  },
);

const DAYS = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
] as const;

type DayTiming = { closed: boolean; open: string; close: string };

const defaultTimings = (): DayTiming[] =>
  DAYS.map((_, index) => ({
    closed: index === 6,
    open: "08:30",
    close: index === 5 ? "14:30" : "17:30",
  }));

function serializeTiming(timing: DayTiming) {
  return timing.closed ? "Closed" : `${timing.open}-${timing.close}`;
}

/** Turns the backend's `["08:30-17:30", "Closed", …]` back into editable rows. */
function parseTimings(timings: string[] | undefined): DayTiming[] {
  const fallback = defaultTimings();
  if (!Array.isArray(timings)) return fallback;

  return fallback.map((day, index) => {
    const raw = timings[index]?.trim();
    if (!raw) return day;
    if (raw.toLowerCase() === "closed") return { ...day, closed: true };

    const [open, close] = raw.split("-");
    if (!open || !close) return day;
    return { closed: false, open, close };
  });
}

type FieldErrors = Partial<
  Record<
    | "name"
    | "address"
    | "coordinates"
    | "imageFile"
    | "timings"
    | "contactNumber"
    | "googleMapsLink",
    string
  >
>;

type FormState = {
  name: string;
  address: string;
  contactNumber: string;
  googleMapsLink: string;
};

const emptyForm: FormState = {
  name: "",
  address: "",
  contactNumber: "",
  googleMapsLink: "",
};

export function ShopForm({
  shop,
  onSaved,
  onCancel,
  embedded = false,
}: {
  /** Omit to create a new shop; pass a shop to edit it in place. */
  shop?: Shop;
  onSaved?: (shop: Shop) => void;
  onCancel?: () => void;
  /** Right-aligns the actions, for rendering inside a modal. */
  embedded?: boolean;
}) {
  const isEdit = Boolean(shop);
  const { token } = useAuth();
  const router = useRouter();

  const [form, setForm] = useState<FormState>(() =>
    shop
      ? {
          name: shop.name ?? "",
          address: shop.address ?? "",
          contactNumber: shop.contactNumber ?? "",
          googleMapsLink: shop.googleMapsLink ?? "",
        }
      : emptyForm,
  );
  const [coordinates, setCoordinates] = useState<LatLng | null>(() =>
    Array.isArray(shop?.coordinates) && shop.coordinates.length === 2
      ? { lat: shop.coordinates[0], lng: shop.coordinates[1] }
      : null,
  );
  const [timings, setTimings] = useState<DayTiming[]>(() =>
    shop ? parseTimings(shop.timings) : defaultTimings(),
  );
  const [imageFileId, setImageFileId] = useState(shop?.imageFile ?? "");
  const [imageName, setImageName] = useState("");
  // Object URL for a freshly picked file; existing images stream from /api/files.
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [message, setMessage] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    return () => {
      if (imagePreview) URL.revokeObjectURL(imagePreview);
    };
  }, [imagePreview]);

  const timingPreview = useMemo(() => timings.map(serializeTiming), [timings]);

  const previewSrc =
    imagePreview ??
    (imageFileId && token
      ? `/api/files/${imageFileId}?token=${encodeURIComponent(token)}`
      : null);

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function updateTiming(index: number, patch: Partial<DayTiming>) {
    setTimings((prev) =>
      prev.map((day, i) => (i === index ? { ...day, ...patch } : day)),
    );
  }

  function copyFirstDayToAll() {
    setTimings((prev) => prev.map(() => ({ ...prev[0] })));
  }

  async function handleImageChange(file: File | null) {
    if (!file) return;

    setIsUploading(true);
    setErrors((prev) => ({ ...prev, imageFile: undefined }));

    const body = new FormData();
    body.append("file", file);
    body.append("convert", "false");

    try {
      const response = await fetch("/api/files", {
        method: "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body,
      });
      const data = (await response.json()) as UploadFileResponse & {
        error?: string;
      };

      if (!response.ok || data.success === false || !data.data?.file?._id) {
        setErrors((prev) => ({
          ...prev,
          imageFile: data.error ?? data.message ?? "Upload failed",
        }));
        return;
      }

      setImageFileId(data.data.file._id);
      setImageName(file.name);
      setImagePreview((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return URL.createObjectURL(file);
      });
    } catch {
      setErrors((prev) => ({ ...prev, imageFile: "Network error during upload" }));
    } finally {
      setIsUploading(false);
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setErrors({});
    setMessage(null);
    setIsSuccess(false);

    const nextErrors: FieldErrors = {};

    if (!form.name.trim()) nextErrors.name = "Name is required";
    if (!form.address.trim()) nextErrors.address = "Address is required";
    if (!coordinates) nextErrors.coordinates = "Pick a location on the map";
    if (!imageFileId) nextErrors.imageFile = "A shop image is required";
    if (!form.contactNumber.trim()) {
      nextErrors.contactNumber = "Contact number is required";
    }
    if (timings.some((day) => !day.closed && (!day.open || !day.close))) {
      nextErrors.timings = "Every open day needs an opening and closing time";
    }
    if (
      form.googleMapsLink.trim() &&
      !/^https?:\/\//i.test(form.googleMapsLink.trim())
    ) {
      nextErrors.googleMapsLink = "Must be a valid http(s) link";
    }

    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      setMessage("Validation failed");
      setIsSubmitting(false);
      return;
    }

    const payload = {
      name: form.name.trim(),
      address: form.address.trim(),
      coordinates: [coordinates!.lat, coordinates!.lng] as [number, number],
      imageFile: imageFileId,
      contactNumber: form.contactNumber.trim(),
      timings: timingPreview,
      ...(form.googleMapsLink.trim()
        ? { googleMapsLink: form.googleMapsLink.trim() }
        : {}),
    };

    try {
      const response = await fetch(
        isEdit ? `/api/shops/${shop!._id}` : "/api/shops",
        {
          method: isEdit ? "PUT" : "POST",
          headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify(payload),
        },
      );

      const data = (await response.json()) as CreateShopResponse & {
        error?: string;
        details?: FieldErrors;
      };

      if (!response.ok || data.success === false) {
        setErrors(data.details ?? {});
        setMessage(data.error ?? data.message ?? "Failed to save shop");
        setIsSubmitting(false);
        return;
      }

      const saved = data.data?.shop;
      setIsSuccess(true);
      onSaved?.(saved ?? ({ ...shop, ...payload } as Shop));

      if (!isEdit) {
        // Nothing left to say on this page — hand the admin back to the list,
        // leaving the button disabled while the navigation settles.
        router.push("/shops");
        router.refresh();
        return;
      }

      setMessage(data.message ?? "Shop updated");
      setIsSubmitting(false);
    } catch {
      setMessage(`Network error while ${isEdit ? "updating" : "creating"} shop`);
      setIsSubmitting(false);
    }
  }

  const inputClass =
    "mt-1.5 w-full rounded-lg border border-border bg-surface px-3 py-2.5 text-sm outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/20";

  return (
    <form onSubmit={handleSubmit}>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block sm:col-span-2">
          <span className="text-sm font-medium">Shop name</span>
          <input
            className={inputClass}
            value={form.name}
            onChange={(e) => update("name", e.target.value)}
            placeholder="Building or block name"
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
            placeholder="Street, area, city"
            required
          />
          {errors.address ? (
            <span className="mt-1 block text-xs text-danger">{errors.address}</span>
          ) : null}
        </label>

        <div className="sm:col-span-2">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <span className="text-sm font-medium">Location</span>
            <span className="text-xs text-muted">
              Click the map to drop a pin, or drag it to fine-tune
            </span>
          </div>
          <div className="mt-1.5">
            <LocationPicker value={coordinates} onChange={setCoordinates} />
          </div>
          <div className="mt-2 grid gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="text-xs text-muted">Latitude</span>
              <input
                className={inputClass}
                value={coordinates?.lat ?? ""}
                onChange={(e) =>
                  setCoordinates((prev) => {
                    const raw = e.target.value.trim();
                    const lat = Number(raw);
                    if (!raw || !Number.isFinite(lat)) return prev;
                    return { lat, lng: prev?.lng ?? 0 };
                  })
                }
                placeholder="00.00000"
                inputMode="decimal"
              />
            </label>
            <label className="block">
              <span className="text-xs text-muted">Longitude</span>
              <input
                className={inputClass}
                value={coordinates?.lng ?? ""}
                onChange={(e) =>
                  setCoordinates((prev) => {
                    const raw = e.target.value.trim();
                    const lng = Number(raw);
                    if (!raw || !Number.isFinite(lng)) return prev;
                    return { lat: prev?.lat ?? 0, lng };
                  })
                }
                placeholder="00.00000"
                inputMode="decimal"
              />
            </label>
          </div>
          {errors.coordinates ? (
            <span className="mt-1 block text-xs text-danger">
              {errors.coordinates}
            </span>
          ) : null}
        </div>

        <div className="block sm:col-span-2">
          <span className="text-sm font-medium">Shop image</span>
          <div className="mt-1.5 flex flex-wrap items-center gap-3">
            <input
              type="file"
              accept="image/*"
              disabled={isUploading}
              onChange={(e) => handleImageChange(e.target.files?.[0] ?? null)}
              className="text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-surface-muted file:px-3 file:py-2 file:text-sm file:font-medium"
            />
            {previewSrc ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={previewSrc}
                alt={imageName || form.name}
                className="h-12 w-12 rounded-lg border border-border object-cover"
              />
            ) : null}
          </div>
          {isUploading || imageName || imageFileId ? (
            <span className="mt-1 block text-xs text-muted">
              {isUploading
                ? "Uploading…"
                : imageName
                  ? imageName
                  : "Choose a file to replace the current image"}
            </span>
          ) : null}
          {errors.imageFile ? (
            <span className="mt-1 block text-xs text-danger">
              {errors.imageFile}
            </span>
          ) : null}
        </div>

        <label className="block">
          <span className="text-sm font-medium">Contact number</span>
          <input
            className={inputClass}
            value={form.contactNumber}
            onChange={(e) => update("contactNumber", e.target.value)}
            placeholder="03XXXXXXXXX"
            required
          />
          {errors.contactNumber ? (
            <span className="mt-1 block text-xs text-danger">
              {errors.contactNumber}
            </span>
          ) : null}
        </label>

        <label className="block">
          <span className="text-sm font-medium">
            Google Maps link{" "}
            <span className="font-normal text-muted">(optional)</span>
          </span>
          <input
            className={inputClass}
            value={form.googleMapsLink}
            onChange={(e) => update("googleMapsLink", e.target.value)}
            placeholder="https://maps.app.goo.gl/…"
            type="url"
          />
          {errors.googleMapsLink ? (
            <span className="mt-1 block text-xs text-danger">
              {errors.googleMapsLink}
            </span>
          ) : null}
        </label>

        <div className="sm:col-span-2">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <span className="text-sm font-medium">Timings</span>
            <button
              type="button"
              onClick={copyFirstDayToAll}
              className="text-xs text-accent hover:underline"
            >
              Apply Monday to all days
            </button>
          </div>

          <div className="mt-1.5 divide-y divide-border rounded-lg border border-border">
            {timings.map((day, index) => (
              <div
                key={DAYS[index]}
                className="flex flex-wrap items-center gap-3 px-3 py-2.5"
              >
                <span className="w-24 text-sm">{DAYS[index]}</span>
                <input
                  type="time"
                  className="rounded-lg border border-border bg-surface px-2 py-1.5 text-sm outline-none transition focus:border-accent disabled:opacity-40"
                  value={day.open}
                  disabled={day.closed}
                  onChange={(e) => updateTiming(index, { open: e.target.value })}
                />
                <span className="text-sm text-muted">to</span>
                <input
                  type="time"
                  className="rounded-lg border border-border bg-surface px-2 py-1.5 text-sm outline-none transition focus:border-accent disabled:opacity-40"
                  value={day.close}
                  disabled={day.closed}
                  onChange={(e) => updateTiming(index, { close: e.target.value })}
                />
                <label className="ml-auto flex items-center gap-2 text-sm text-muted">
                  <input
                    type="checkbox"
                    checked={day.closed}
                    onChange={(e) =>
                      updateTiming(index, { closed: e.target.checked })
                    }
                  />
                  Closed
                </label>
              </div>
            ))}
          </div>
          {errors.timings ? (
            <span className="mt-1 block text-xs text-danger">{errors.timings}</span>
          ) : null}
        </div>
      </div>

      <div
        className={`mt-6 flex flex-wrap items-center gap-3 ${embedded ? "justify-end" : ""}`}
      >
        {message ? (
          <p className={`mr-auto text-sm ${isSuccess ? "text-accent" : "text-danger"}`}>
            {message}
          </p>
        ) : null}
        {onCancel ? (
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 border border-border rounded-lg text-sm hover:bg-surface-muted transition"
          >
            Cancel
          </button>
        ) : null}
        <button
          type="submit"
          disabled={isSubmitting || isUploading}
          className="px-4 py-2 bg-accent text-white rounded-lg text-sm font-medium hover:bg-accent-hover transition disabled:opacity-50"
        >
          {isSubmitting
            ? isEdit
              ? "Saving…"
              : "Creating…"
            : isEdit
              ? "Save changes"
              : "Create shop"}
        </button>
      </div>
    </form>
  );
}
