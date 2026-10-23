const storeKey = "pocket-ledger-invoices";
const databaseName = "pocket-ledger-files";
let invoices = [];
let selectedMonth = new Date();

const $ = (selector) => document.querySelector(selector);
const money = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 });
const formatMonth = (date) => new Intl.DateTimeFormat("en-IN", { month: "long", year: "numeric" }).format(date);
const bytes = (value) => value < 1024 * 1024 ? `${Math.max(1, Math.round(value / 1024))} KB` : `${(value / 1024 / 1024).toFixed(1)} MB`;

function inferCategory(name) {
  const file = name.toLowerCase();
  if (/(petrol|fuel|diesel|shell|bharat|indian oil|hpcl)/.test(file)) return "fuel";
  if (/(movie|cinema|game|concert|ticket|netflix|spotify|fun)/.test(file)) return "fun";
  return "food";
}
function database() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(databaseName, 1);
    request.onupgradeneeded = () => request.result.createObjectStore("files");
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}
async function writeFile(id, file) {
  const db = await database();
  await new Promise((resolve, reject) => { const tx = db.transaction("files", "readwrite"); tx.objectStore("files").put(file, id); tx.oncomplete = resolve; tx.onerror = () => reject(tx.error); });
}
async function readFile(id) {
  const db = await database();
  return new Promise((resolve, reject) => { const tx = db.transaction("files"); const request = tx.objectStore("files").get(id); request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error); });
}
async function removeFile(id) {
  const db = await database();
  await new Promise((resolve, reject) => { const tx = db.transaction("files", "readwrite"); tx.objectStore("files").delete(id); tx.oncomplete = resolve; tx.onerror = () => reject(tx.error); });
}
function save() { localStorage.setItem(storeKey, JSON.stringify(invoices.map(({ url, ...invoice }) => invoice))); }
function displayName(category) { return category[0].toUpperCase() + category.slice(1); }
function updateHeader() { $("#currentMonth").textContent = formatMonth(selectedMonth); }
function render() {
  const list = $("#invoiceList"); list.innerHTML = "";
  const totals = { food: 0, fuel: 0, fun: 0 };
  const counts = { food: 0, fuel: 0, fun: 0 };
  invoices.forEach((invoice) => { totals[invoice.category] += Number(invoice.amount) || 0; counts[invoice.category]++; });
  const total = Object.values(totals).reduce((a, b) => a + b, 0);
  $("#totalSpend").textContent = money.format(total); $("#invoiceCount").textContent = `${invoices.length} invoice${invoices.length === 1 ? "" : "s"}`;
  ["food", "fuel", "fun"].forEach((category) => { $(`#${category}Total`).textContent = money.format(totals[category]); $(`#${category}Count`).textContent = `${counts[category]} invoice${counts[category] === 1 ? "" : "s"}`; });
  $("#emptyState").hidden = invoices.length > 0;
  invoices.forEach((invoice) => {
    const node = $("#invoiceTemplate").content.cloneNode(true);
    const row = node.querySelector(".invoice-row");
    row.querySelector(".file-type").textContent = invoice.type === "application/pdf" ? "PDF" : "IMG";
    row.querySelector(".invoice-name strong").textContent = invoice.name;
    row.querySelector(".invoice-name span").textContent = `${bytes(invoice.size)} · ${displayName(invoice.category)}`;
    const amount = row.querySelector("input"); amount.value = invoice.amount || ""; amount.addEventListener("change", () => { invoice.amount = Math.max(0, Number(amount.value) || 0); save(); render(); });
    const category = row.querySelector("select"); category.value = invoice.category; category.addEventListener("change", () => { invoice.category = category.value; save(); render(); });
    const view = row.querySelector(".view-file"); view.href = invoice.url || "#";
    row.querySelector(".delete-button").addEventListener("click", async () => { await removeFile(invoice.id); invoices = invoices.filter((item) => item.id !== invoice.id); save(); render(); });
    list.append(node);
  });
}
async function upload(files) {
  for (const file of [...files].filter((file) => ["application/pdf", "image/png", "image/jpeg"].includes(file.type))) {
    const id = crypto.randomUUID();
    await writeFile(id, file);
    invoices.unshift({ id, name: file.name, type: file.type, size: file.size, category: inferCategory(file.name), amount: 0, url: URL.createObjectURL(file) });
  }
  save(); render();
}
const dropzone = $("#dropzone"); const picker = $("#fileInput");
dropzone.addEventListener("click", () => picker.click()); dropzone.addEventListener("keydown", (event) => { if (event.key === "Enter" || event.key === " ") picker.click(); });
picker.addEventListener("change", (event) => upload(event.target.files));
["dragenter", "dragover"].forEach((event) => dropzone.addEventListener(event, (e) => { e.preventDefault(); dropzone.classList.add("dragging"); }));
["dragleave", "drop"].forEach((event) => dropzone.addEventListener(event, (e) => { e.preventDefault(); dropzone.classList.remove("dragging"); }));
dropzone.addEventListener("drop", (event) => upload(event.dataTransfer.files));
$("#topUpload").addEventListener("click", () => picker.click());
$("#clearAll").addEventListener("click", async () => { if (invoices.length && confirm("Remove all invoices from your ledger?")) { await Promise.all(invoices.map((invoice) => removeFile(invoice.id))); invoices = []; save(); render(); } });
$("#previousMonth").addEventListener("click", () => { selectedMonth.setMonth(selectedMonth.getMonth() - 1); updateHeader(); });
$("#nextMonth").addEventListener("click", () => { selectedMonth.setMonth(selectedMonth.getMonth() + 1); updateHeader(); });
async function initialize() {
  invoices = JSON.parse(localStorage.getItem(storeKey) || "[]");
  await Promise.all(invoices.map(async (invoice) => { const file = await readFile(invoice.id); if (file) invoice.url = URL.createObjectURL(file); }));
  updateHeader(); render();
}
initialize();
