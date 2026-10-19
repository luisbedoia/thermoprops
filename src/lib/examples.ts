import { TEMPLATES } from "../dsl/templates";

/** A worksheet link that opens with an example's script. */
export function exampleLink(id: string) {
  const t = TEMPLATES.find((x) => x.id === id)!;
  return {
    pathname: "/worksheet",
    search: `?${new URLSearchParams({ s: t.source }).toString()}`,
  };
}
