import type { ServiceInput } from "@/lib/types";

/**
 * Validates a service create/update body. POST and PUT take the same shape:
 * a rate, the `keys` combination the service prices, and the printers that
 * fulfil it. `name` is derived by the backend and never sent.
 */
export function parseServicePayload(body: unknown): {
  payload?: ServiceInput;
  details?: Record<string, string>;
} {
  const details: Record<string, string> = {};

  if (!body || typeof body !== "object") {
    return { details: { body: "Request body must be an object" } };
  }

  const { rate, keys, printers } = body as Record<string, unknown>;

  if (typeof rate !== "number" || !Number.isFinite(rate) || rate < 0) {
    details.rate = "rate must be a non-negative number";
  }

  const keyObj = (keys ?? {}) as Record<string, unknown>;
  if (!keys || typeof keys !== "object") {
    details.keys = "keys is required";
  } else {
    if (typeof keyObj.pageType !== "string" || !keyObj.pageType.trim()) {
      details["keys.pageType"] = "keys.pageType must be a non-empty string";
    }
    if (typeof keyObj.color !== "boolean") {
      details["keys.color"] = "keys.color must be a boolean";
    }
    if (typeof keyObj.sidedness !== "boolean") {
      details["keys.sidedness"] = "keys.sidedness must be a boolean";
    }
  }

  const cleanPrinters: { useAuto: boolean; printer: string }[] = [];
  if (!Array.isArray(printers)) {
    details.printers = "printers must be an array";
  } else {
    printers.forEach((entry, i) => {
      const { useAuto, printer } = (entry ?? {}) as Record<string, unknown>;
      if (typeof printer !== "string" || !printer.trim()) {
        details[`printers[${i}].printer`] = "printer must be a printer id";
        return;
      }
      cleanPrinters.push({ useAuto: useAuto === true, printer: printer.trim() });
    });
  }

  if (Object.keys(details).length > 0) return { details };

  return {
    payload: {
      rate: rate as number,
      keys: {
        pageType: (keyObj.pageType as string).trim(),
        color: keyObj.color as boolean,
        sidedness: keyObj.sidedness as boolean,
      },
      printers: cleanPrinters,
    },
  };
}
