import assert from "node:assert";
import test from "node:test";
import { parseWideMatrix, summarizeRows } from "./parse-xlsx.js";

test("parseWideMatrix extracts module headers and eisen rows", () => {
  const rows = [
    ["Niveau 1", "", "Niveau 2", ""],
    [],
    [],
    ["Veiligheid", "", "Veiligheid", ""],
    ["Wind", "Wind eis niveau 1", "Wind 2", "Wind eis niveau 2"],
    ["Keuzemodule: Foiling", "", "", ""],
    ["Foiling skill", "Foiling eis", "", ""],
  ];

  const parsed = parseWideMatrix(rows);

  assert.equal(parsed.length, 3);

  assert.deepEqual(parsed[0], {
    niveau: "1",
    module: "Veiligheid",
    type: "Verplicht",
    competentie: "Wind",
    eis: "Wind eis niveau 1",
  });

  assert.deepEqual(parsed[1], {
    niveau: "2",
    module: "Veiligheid",
    type: "Verplicht",
    competentie: "Wind 2",
    eis: "Wind eis niveau 2",
  });

  assert.deepEqual(parsed[2], {
    niveau: "1",
    module: "Keuzemodule: Foiling",
    type: "Optioneel",
    competentie: "Foiling skill",
    eis: "Foiling eis",
  });

  const counts = summarizeRows(parsed);
  assert.equal(counts["1"], 2);
  assert.equal(counts["2"], 1);
});
