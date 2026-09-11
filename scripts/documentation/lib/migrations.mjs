/**
 * EF Core migrations as SCHEMA HISTORY, not as source components.
 *
 * WHY THIS IS A SPECIAL CASE. `src/Infrastructure/Persistence/Migrations` is 34,409 lines — 65% of
 * all the C# in this repository — and almost all of it is generated `*.Designer.cs` model
 * snapshots. Indexing that the way ordinary source is indexed would produce thousands of
 * meaningless nodes, and every change-impact report would drown in them.
 *
 * So: Designer files and the model snapshot are skipped outright, and the migration itself is read
 * for the only thing that carries meaning — the schema OPERATIONS in its Up and Down methods. A
 * migration becomes one entity describing what it did to which tables, which is exactly the
 * granularity a database-impact question needs.
 */

const OPERATIONS = [
  { op: "CreateTable", pattern: /migrationBuilder\.CreateTable\(\s*name:\s*"([^"]+)"/g, capture: "table" },
  { op: "DropTable", pattern: /migrationBuilder\.DropTable\(\s*name:\s*"([^"]+)"/g, capture: "table" },
  { op: "RenameTable", pattern: /migrationBuilder\.RenameTable\(\s*name:\s*"([^"]+)"/g, capture: "table" },
  { op: "AddColumn", pattern: /migrationBuilder\.AddColumn<[^>]*>\(\s*name:\s*"([^"]+)",\s*table:\s*"([^"]+)"/g, capture: "column+table" },
  { op: "DropColumn", pattern: /migrationBuilder\.DropColumn\(\s*name:\s*"([^"]+)",\s*table:\s*"([^"]+)"/g, capture: "column+table" },
  { op: "AlterColumn", pattern: /migrationBuilder\.AlterColumn<[^>]*>\(\s*name:\s*"([^"]+)",\s*table:\s*"([^"]+)"/g, capture: "column+table" },
  { op: "RenameColumn", pattern: /migrationBuilder\.RenameColumn\(\s*name:\s*"([^"]+)",\s*table:\s*"([^"]+)"/g, capture: "column+table" },
  { op: "CreateIndex", pattern: /migrationBuilder\.CreateIndex\(\s*name:\s*"([^"]+)",\s*table:\s*"([^"]+)"/g, capture: "name+table" },
  { op: "DropIndex", pattern: /migrationBuilder\.DropIndex\(\s*name:\s*"([^"]+)",\s*table:\s*"([^"]+)"/g, capture: "name+table" },
  { op: "AddForeignKey", pattern: /migrationBuilder\.AddForeignKey\(\s*name:\s*"([^"]+)",\s*table:\s*"([^"]+)"/g, capture: "name+table" },
  { op: "DropForeignKey", pattern: /migrationBuilder\.DropForeignKey\(\s*name:\s*"([^"]+)",\s*table:\s*"([^"]+)"/g, capture: "name+table" },
  { op: "AddPrimaryKey", pattern: /migrationBuilder\.AddPrimaryKey\(\s*name:\s*"([^"]+)",\s*table:\s*"([^"]+)"/g, capture: "name+table" },
  { op: "AddUniqueConstraint", pattern: /migrationBuilder\.AddUniqueConstraint\(\s*name:\s*"([^"]+)",\s*table:\s*"([^"]+)"/g, capture: "name+table" },
  { op: "InsertData", pattern: /migrationBuilder\.InsertData\(\s*table:\s*"([^"]+)"/g, capture: "table" },
  { op: "DeleteData", pattern: /migrationBuilder\.DeleteData\(\s*table:\s*"([^"]+)"/g, capture: "table" },
  { op: "UpdateData", pattern: /migrationBuilder\.UpdateData\(\s*table:\s*"([^"]+)"/g, capture: "table" },
  { op: "CreateSequence", pattern: /migrationBuilder\.CreateSequence(?:<[^>]*>)?\(\s*name:\s*"([^"]+)"/g, capture: "name" },
  { op: "DropSequence", pattern: /migrationBuilder\.DropSequence\(\s*name:\s*"([^"]+)"/g, capture: "name" },
  { op: "Sql", pattern: /migrationBuilder\.Sql\(/g, capture: "none" },
];

export function isMigrationFile(relativePath) {
  return /\/Migrations\//.test(relativePath);
}

/** Designer files and the model snapshot carry no decisions — only a serialised model. */
export function isGeneratedMigrationArtifact(relativePath) {
  return /\.Designer\.cs$/.test(relativePath) || /ModelSnapshot\.cs$/.test(relativePath);
}

/**
 * Which half of the migration a character offset falls in.
 *
 * Down() operations matter for rollback analysis but must never be reported as things the schema
 * now has — a DropColumn in Down is the undo of an AddColumn in Up.
 */
function directionAt(source, offset) {
  const upIndex = source.search(/protected\s+override\s+void\s+Up\s*\(/);
  const downIndex = source.search(/protected\s+override\s+void\s+Down\s*\(/);
  if (downIndex !== -1 && offset >= downIndex) return "down";
  if (upIndex !== -1 && offset >= upIndex) return "up";
  return "up";
}

function lineAt(source, offset) {
  let line = 1;
  for (let i = 0; i < offset && i < source.length; i++) {
    if (source[i] === "\n") line++;
  }
  return line;
}

export function parseMigration(source, relativePath) {
  const fileName = relativePath.split("/").pop() ?? relativePath;
  const nameMatch = /^(\d{14})_(.+)\.cs$/.exec(fileName);

  const operations = [];
  const tables = new Set();
  let rawSql = false;

  for (const { op, pattern, capture } of OPERATIONS) {
    pattern.lastIndex = 0;
    let match;
    while ((match = pattern.exec(source)) !== null) {
      const direction = directionAt(source, match.index);
      const line = lineAt(source, match.index);

      const entry = { op, direction, line, table: null, column: null, name: null, detail: null };

      if (capture === "table") entry.table = match[1];
      else if (capture === "name") entry.name = match[1];
      else if (capture === "column+table") { entry.column = match[1]; entry.table = match[2]; }
      else if (capture === "name+table") { entry.name = match[1]; entry.table = match[2]; }
      else if (capture === "none") {
        rawSql = true;
        entry.detail = "raw SQL executed — inspect the migration directly; not parsed";
      }

      if (entry.table) tables.add(entry.table);
      operations.push(entry);
    }
  }

  return {
    id: nameMatch ? `${nameMatch[1]}_${nameMatch[2]}` : fileName.replace(/\.cs$/, ""),
    name: nameMatch ? nameMatch[2] : fileName.replace(/\.cs$/, ""),
    timestamp: nameMatch ? nameMatch[1] : null,
    path: relativePath,
    operations: operations.sort((a, b) => a.line - b.line),
    tables_touched: [...tables].sort(),
    raw_sql: rawSql,
  };
}
