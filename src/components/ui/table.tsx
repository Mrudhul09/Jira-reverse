import type { ComponentProps } from "react";
import { cx } from "./index";

export function Table({ className, ...rest }: ComponentProps<"table">) {
  return (
    <div className="relative overflow-x-auto rounded-lg border border-line bg-canvas">
      <table className={cx("w-full border-collapse", className)} {...rest} />
    </div>
  );
}

export function Th({ className, ...rest }: ComponentProps<"th">) {
  return <th scope="col" className={cx("whitespace-nowrap border-b border-line bg-surface px-2.5 py-2 text-left text-xs font-semibold text-muted", className)} {...rest} />;
}

export function Td({ className, ...rest }: ComponentProps<"td">) {
  return <td className={cx("border-b border-line px-2.5 py-2 align-middle", className)} {...rest} />;
}

export function Tr({ className, ...rest }: ComponentProps<"tr">) {
  return <tr className={cx("last:[&>td]:border-b-0 hover:bg-surface/60", className)} {...rest} />;
}
