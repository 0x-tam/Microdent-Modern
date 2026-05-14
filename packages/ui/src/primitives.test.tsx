import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { Badge } from "./components/Badge.js";
import { Button } from "./components/Button.js";
import { Card, CardBody, CardFooter, CardHeader, CardTitle } from "./components/Card.js";
import { EmptyState } from "./components/EmptyState.js";
import { ErrorState } from "./components/ErrorState.js";
import { Input } from "./components/Input.js";
import { LoadingState } from "./components/LoadingState.js";
import { ReadOnlyBanner } from "./components/ReadOnlyBanner.js";
import { Table, TableBody, TableCell, TableHead, TableHeaderCell, TableRow } from "./components/Table.js";

describe("UI primitives (static markup)", () => {
  it("Button renders as native button with focusable class", () => {
    const html = renderToStaticMarkup(<Button variant="secondary">Save</Button>);
    expect(html).toContain('type="button"');
    expect(html).toContain("ui-btn");
    expect(html).toContain("ui-focusable");
    expect(html).toContain("ui-btn--secondary");
  });

  it("Card composes header, title, body", () => {
    const html = renderToStaticMarkup(
      <Card>
        <CardHeader>
          <CardTitle>Panel</CardTitle>
        </CardHeader>
        <CardBody>Content</CardBody>
      </Card>,
    );
    expect(html).toContain("ui-card__header");
    expect(html).toContain("ui-card__title");
    expect(html).toContain("Content");
  });

  it("Table uses semantic table and scoped column headers", () => {
    const html = renderToStaticMarkup(
      <Table>
        <TableHead>
          <TableRow>
            <TableHeaderCell>Name</TableHeaderCell>
          </TableRow>
        </TableHead>
        <TableBody>
          <TableRow>
            <TableCell>Fixture</TableCell>
          </TableRow>
        </TableBody>
      </Table>,
    );
    expect(html).toContain("<table");
    expect(html).toContain('scope="col"');
  });

  it("TableCell numeric adds alignment class", () => {
    const html = renderToStaticMarkup(
      <Table>
        <TableBody>
          <TableRow>
            <TableCell numeric>12</TableCell>
          </TableRow>
        </TableBody>
      </Table>,
    );
    expect(html).toContain("ui-table__numeric");
  });

  it("Badge exposes semantic aria-label and visible dot", () => {
    const html = renderToStaticMarkup(
      <Badge variant="success" semanticLabel="Status: Completed">
        Done
      </Badge>,
    );
    expect(html).toContain('aria-label="Status: Completed"');
    expect(html).toContain("ui-badge__dot");
  });

  it("Input wires label, hint, error ids", () => {
    const html = renderToStaticMarkup(
      <Input
        inputId="q-demo"
        label="Search"
        hint="Try a fixture id."
        error="Required"
        defaultValue=""
      />,
    );
    expect(html).toContain('for="q-demo"');
    expect(html).toContain('id="q-demo"');
    expect(html).toContain("aria-invalid");
    expect(html).toContain("q-demo-error");
  });

  it("EmptyState exposes region label", () => {
    const html = renderToStaticMarkup(
      <EmptyState title="Nothing here" description="Add a row to see data." />,
    );
    expect(html).toContain('aria-label="Nothing here"');
  });

  it("ReadOnlyBanner is polite status", () => {
    const html = renderToStaticMarkup(
      <ReadOnlyBanner>Edits are disabled in this phase.</ReadOnlyBanner>,
    );
    expect(html).toContain('role="status"');
    expect(html).toContain("Read-only");
  });

  it("LoadingState exposes busy status", () => {
    const html = renderToStaticMarkup(<LoadingState label="Fetching rows" />);
    expect(html).toContain('aria-busy="true"');
  });

  it("ErrorState is alert", () => {
    const html = renderToStaticMarkup(
      <ErrorState title="Bridge offline" message="Check that the local service is running." />,
    );
    expect(html).toContain('role="alert"');
  });
});
