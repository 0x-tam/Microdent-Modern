import type { HTMLAttributes, TdHTMLAttributes, ThHTMLAttributes } from "react";
import { classNames } from "../util/classNames.js";

export type TableProps = HTMLAttributes<HTMLTableElement> & {
  striped?: boolean;
  compact?: boolean;
};

export function Table({ className, children, striped, compact, ...rest }: TableProps) {
  return (
    <div className="ui-table-wrap">
      <table
        className={classNames(
          "ui-table",
          striped && "ui-table--striped",
          compact && "ui-table--compact",
          className,
        )}
        {...rest}
      >
        {children}
      </table>
    </div>
  );
}

export function TableHead(props: HTMLAttributes<HTMLTableSectionElement>) {
  return <thead {...props} />;
}

export function TableBody(props: HTMLAttributes<HTMLTableSectionElement>) {
  return <tbody {...props} />;
}

export function TableRow(props: HTMLAttributes<HTMLTableRowElement>) {
  return <tr {...props} />;
}

export function TableHeaderCell(props: ThHTMLAttributes<HTMLTableCellElement>) {
  return <th scope="col" {...props} />;
}

export type TableCellProps = TdHTMLAttributes<HTMLTableCellElement> & { numeric?: boolean };

export function TableCell({ className, numeric, ...rest }: TableCellProps) {
  return <td className={classNames(numeric && "ui-table__numeric", className)} {...rest} />;
}
