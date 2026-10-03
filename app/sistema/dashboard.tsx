"use client";

import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";

type DashboardProps = { name: string; email: string;  };
type Theme = "light" | "dark";
type View = "overview" | "orders" | "clients" | "stock" | "reports" | "notifications";
type Modal = "client" | "stock" | "order" | "orderDetails" | null;
type OrderStatus = "Em análise" | "Aguardando aprovação" | "Aprovado" | "Em reparo" | "Aguardando peça" | "Pronto" | "Entregue" | "Cancelado";
type PaymentMethod = "A definir" | "Pix" | "Dinheiro" | "Cartão de crédito" | "Cartão de débito" | "Boleto";
type PaymentStatus = "Pendente" | "Parcial" | "Pago";

type Client = {
  version: number;
  id: string;
  name: string;
  phone: string;
  email: string;
  document: string;
  createdAt: string;
};

type StockItem = {
  version: number;
  productVersion: number;
  id: string;
  name: string;
  sku: string;
  quantity: number;
  minimum: number;
  cost: number;
  price: number;
  createdAt: string;
};

type OrderPart = {
  stockItemId: string;
  name: string;
  quantity: number;
  unitPrice: number;
};

type OrderHistoryEntry = {
  id: string;
  at: string;
  action: string;
};

type ServiceOrder = {
  version: number;
  id: string;
  clientId: string;
  device: string;
  service: string;
  status: OrderStatus;
  technician: string;
  dueDate: string;
  paymentMethod: PaymentMethod;
  paymentStatus: PaymentStatus;
  notes: string;
  parts: OrderPart[];
  history: OrderHistoryEntry[];
  value: number;
  createdAt: string;
  updatedAt: string;
};

type SystemData = {
  clients: Client[];
  stock: StockItem[];
  orders: ServiceOrder[];
};

const STORAGE_KEY = "digital-mais-system-v2";
const EMPTY_DATA: SystemData = { clients: [], stock: [], orders: [] };
const ORDER_STATUSES: OrderStatus[] = ["Em análise", "Aguardando aprovação", "Aprovado", "Em reparo", "Aguardando peça", "Pronto", "Entregue", "Cancelado"];
const PAYMENT_METHODS: PaymentMethod[] = ["A definir", "Pix", "Dinheiro", "Cartão de crédito", "Cartão de débito", "Boleto"];
const PAYMENT_STATUSES: PaymentStatus[] = ["Pendente", "Parcial", "Pago"];

const navItems: Array<{ id: View; label: string; icon: string }> = [
  { id: "overview", label: "Visão geral", icon: "grid" },
  { id: "orders", label: "Ordens de serviço", icon: "file" },
  { id: "clients", label: "Clientes", icon: "users" },
  { id: "stock", label: "Estoque", icon: "box" },
  { id: "reports", label: "Relatórios", icon: "chart" },
  { id: "notifications", label: "Notificações", icon: "bell" },
];

const iconPaths: Record<string, React.ReactNode> = {
  grid: <><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></>,
  file: <><path d="M6 2h9l4 4v16H6z"/><path d="M14 2v5h5M9 12h6M9 16h6"/></>,
  users: <><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/></>,
  box: <><path d="m21 8-9 5-9-5 9-5z"/><path d="m3 8 9 5 9-5v10l-9 5-9-5zM12 13v10"/></>,
  chart: <><path d="M4 19V9M10 19V5M16 19v-7M22 19V2M2 22h22"/></>,
  search: <><circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/></>,
  bell: <><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4"/></>,
  menu: <><path d="M4 6h16M4 12h16M4 18h16"/></>,
  close: <><path d="m6 6 12 12M18 6 6 18"/></>,
  plus: <><path d="M12 5v14M5 12h14"/></>,
  home: <><path d="m3 11 9-8 9 8v10h-6v-6H9v6H3z"/></>,
  logout: <><path d="M10 17l5-5-5-5M15 12H3M15 3h5v18h-5"/></>,
  sun: <><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.42 1.42M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.42-1.42M17.66 6.34l1.41-1.41"/></>,
  moon: <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>,
  edit: <><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L8 18l-4 1 1-4z"/></>,
  trash: <><path d="M3 6h18M8 6V4h8v2M7 6l1 16h8l1-16M10 11v6M14 11v6"/></>,
  download: <><path d="M12 3v12M7 10l5 5 5-5M4 21h16"/></>,
  minus: <path d="M5 12h14"/>,
  eye: <><path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12z"/><circle cx="12" cy="12" r="2.5"/></>,
  print: <><path d="M6 9V3h12v6M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><path d="M6 14h12v8H6z"/></>,
};

function Icon({ name, size = 19 }: { name: string; size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{iconPaths[name]}</svg>;
}

function money(value: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
}


function shortDate(value: string) {
  if (!value) return "—";
  const date = /^\d{4}-\d{2}-\d{2}$/.test(value) ? new Date(`${value}T12:00:00`) : new Date(value);
  return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short", year: "numeric" }).format(date);
}

function dateTime(value: string) {
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(new Date(value));
}


function statusClass(status: OrderStatus) {
  const slug = status.toLowerCase().replaceAll(" ", "-").normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  return `order-status order-status--${slug}`;
}

function safeCsv(value: string | number) {
  return `"${String(value).replaceAll('"', '""')}"`;
}

export default function Dashboard({ name, email }: DashboardProps) {
  const [theme, setTheme] = useState<Theme>("light");
  const [activeView, setActiveView] = useState<View>("overview");
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"Todos" | OrderStatus>("Todos");
  const [reportStart, setReportStart] = useState("");
  const [reportEnd, setReportEnd] = useState("");
  const [systemMessage, setSystemMessage] = useState("");

  const [modal, setModal] = useState<Modal>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [data, setData] = useState<SystemData>(EMPTY_DATA);
  const [hydrated, setHydrated] = useState(false);
  const [busy, setBusy] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [stores, setStores] = useState<Array<{ id: string; name: string }>>([]);
  const [storeId, setStoreId] = useState("");
  const [hasLocalData, setHasLocalData] = useState(false);
  const storeRef = useRef("");
  const busyRef = useRef(false);
  const requestRef = useRef(0);
  const modalRef = useRef<Modal>(null);
  modalRef.current = modal;

  const reloadData = useCallback(async (store = storeRef.current) => {
    const request = ++requestRef.current;
    const response = await fetch("/api/erp" + (store ? "?store=" + encodeURIComponent(store) : ""), { cache: "no-store" });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || "Não foi possível carregar os dados.");
    if (request !== requestRef.current || (modalRef.current && !busyRef.current)) return;
    setData({ clients: result.clients, stock: result.stock, orders: result.orders });
    setStores(result.stores);
    storeRef.current = result.storeId ?? "";
    setStoreId(result.storeId ?? "");
    setLoadError("");
    setHydrated(true);
  }, []);

  const mutate = async (action: string, payload: unknown) => {
    if (busyRef.current) return false;
    if (!storeRef.current || loadError) { window.alert("Atualize os dados e selecione uma loja antes de salvar."); return false; }
    busyRef.current = true;
    setBusy(true);
    ++requestRef.current;
    let saved = false;
    try {
      const response = await fetch("/api/erp", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action, storeId: storeRef.current, payload }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Não foi possível salvar.");
      saved = true;
      await reloadData();
      setSystemMessage("Alterações salvas no banco da equipe.");
      return true;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Falha de conexão.";
      if (saved) {
        setLoadError("A alteração foi salva, mas a atualização da tela falhou. Clique em atualizar; não repita o cadastro.");
        return true;
      }
      window.alert(message);
      // Não repete escritas: uma falha de rede pode ocorrer depois do commit.
      setLoadError("Atualize os dados antes de continuar. " + message);
      return false;
    } finally { busyRef.current = false; setBusy(false); }
  };

  const switchStore = async (id: string) => {
    if (busyRef.current) return;
    busyRef.current = true; setBusy(true); setModal(null); setEditingId(null);
    try { await reloadData(id); }
    catch (error) { setLoadError(error instanceof Error ? error.message : "Falha ao carregar a loja."); }
    finally { busyRef.current = false; setBusy(false); }
  };

  const downloadLocalBackup = () => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) return;
    const url = URL.createObjectURL(new Blob([saved], { type: "application/json" }));
    const link = document.createElement("a"); link.href = url; link.download = "digital-mais-dados-locais.json"; link.click(); URL.revokeObjectURL(url);
  };

  const firstName = name.trim().split(/\s+/)[0] || "usuário";
  const initials = name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join("").toUpperCase();

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      try {
        const initialTheme: Theme = localStorage.getItem("digital-mais-theme") === "dark" ? "dark" : "light";
        setTheme(initialTheme);
        document.documentElement.dataset.theme = initialTheme;
        const legacy = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
        setHasLocalData(Boolean(legacy.clients?.length || legacy.stock?.length || legacy.orders?.length));
      } catch { /* Dados locais permanecem intactos. */ }
    });
    const refresh = () => {
      if (busyRef.current || modalRef.current || document.visibilityState === "hidden") return;
      void reloadData().catch((error) => setLoadError(error instanceof Error ? error.message : "Falha de conexão."));
    };
    refresh();
    const interval = window.setInterval(refresh, 30000);
    window.addEventListener("focus", refresh);
    return () => { window.cancelAnimationFrame(frame); window.clearInterval(interval); window.removeEventListener("focus", refresh); ++requestRef.current; };
  }, [reloadData]);

  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeModal();
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, []);

  useEffect(() => {
    if (!systemMessage) return;
    const timeout = window.setTimeout(() => setSystemMessage(""), 6000);
    return () => window.clearTimeout(timeout);
  }, [systemMessage]);

  const clientById = useMemo(() => new Map(data.clients.map((client) => [client.id, client])), [data.clients]);
  const lowStock = useMemo(() => data.stock.filter((item) => item.quantity <= item.minimum), [data.stock]);
  const openOrders = useMemo(() => data.orders.filter((order) => order.status !== "Entregue" && order.status !== "Cancelado"), [data.orders]);
  const readyOrders = useMemo(() => data.orders.filter((order) => order.status === "Pronto"), [data.orders]);
  const waitingPieceOrders = useMemo(() => data.orders.filter((order) => order.status === "Aguardando peça"), [data.orders]);
  const deliveredOrders = useMemo(() => data.orders.filter((order) => order.status === "Entregue"), [data.orders]);
  const notificationCount = lowStock.length + readyOrders.length + waitingPieceOrders.length;
  const revenue = deliveredOrders.reduce((total, order) => total + order.value, 0);
  const stockValue = data.stock.reduce((total, item) => total + item.cost * item.quantity, 0);
  const reportOrders = useMemo(() => data.orders.filter((order) => {
    const orderDate = order.createdAt.slice(0, 10);
    return (!reportStart || orderDate >= reportStart) && (!reportEnd || orderDate <= reportEnd);
  }), [data.orders, reportEnd, reportStart]);
  const reportDeliveredOrders = useMemo(() => reportOrders.filter((order) => order.status === "Entregue"), [reportOrders]);
  const reportRevenue = reportDeliveredOrders.reduce((total, order) => total + order.value, 0);
  const reportProjectedRevenue = reportOrders.filter((order) => order.status !== "Cancelado").reduce((total, order) => total + order.value, 0);
  const normalizedQuery = query.trim().toLocaleLowerCase("pt-BR");

  const filteredOrders = useMemo(() => data.orders.filter((order) => {
    const client = clientById.get(order.clientId)?.name ?? "Cliente removido";
    const matchesStatus = statusFilter === "Todos" || order.status === statusFilter;
    const matchesQuery = !normalizedQuery || [order.id, client, order.device, order.service].some((value) => value.toLocaleLowerCase("pt-BR").includes(normalizedQuery));
    return matchesStatus && matchesQuery;
  }), [clientById, data.orders, normalizedQuery, statusFilter]);

  const filteredClients = useMemo(() => data.clients.filter((client) => !normalizedQuery || [client.name, client.email, client.phone, client.document].some((value) => value.toLocaleLowerCase("pt-BR").includes(normalizedQuery))), [data.clients, normalizedQuery]);
  const filteredStock = useMemo(() => data.stock.filter((item) => !normalizedQuery || [item.name, item.sku].some((value) => value.toLocaleLowerCase("pt-BR").includes(normalizedQuery))), [data.stock, normalizedQuery]);

  const editingClient = editingId ? data.clients.find((client) => client.id === editingId) : undefined;
  const editingStock = editingId ? data.stock.find((item) => item.id === editingId) : undefined;
  const editingOrder = editingId ? data.orders.find((order) => order.id === editingId) : undefined;

  const changeView = (view: View) => {
    setActiveView(view);
    setQuery("");
  };

  const openOrdersByStatus = (status: OrderStatus) => {
    setStatusFilter(status);
    changeView("orders");
  };

  const toggleTheme = () => {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    document.documentElement.dataset.theme = next;
    localStorage.setItem("digital-mais-theme", next);
  };

  const openModal = (type: Exclude<Modal, null>, id?: string) => {
    if (type === "order" && !id && data.clients.length === 0) {
      window.alert("Cadastre pelo menos um cliente antes de criar uma ordem de serviço.");
      changeView("clients");
      return;
    }
    if (busyRef.current || loadError || !storeRef.current) return;
    modalRef.current = type;
    setEditingId(id ?? null);
    setModal(type);
  };

  function closeModal() {
    if (busyRef.current) return;
    setModal(null);
    setEditingId(null);
  }

  const saveClient = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    if (await mutate("saveClient", { id: editingClient?.id, version: editingClient?.version, name: form.get("name"), phone: form.get("phone"), email: form.get("email"), document: form.get("document") })) closeModal();
  };

  const saveStock = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    if (await mutate("saveStock", { id: editingStock?.id, version: editingStock?.version, productVersion: editingStock?.productVersion, name: form.get("name"), sku: form.get("sku"), quantity: Number(form.get("quantity")), minimum: Number(form.get("minimum")), cost: Number(form.get("cost")), price: Number(form.get("price")) })) closeModal();
  };

  const saveOrder = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const parts = data.stock.flatMap((item) => {
      const quantity = Number(form.get("part-" + item.id) ?? 0);
      const previous = editingOrder?.parts.find((part) => part.stockItemId === item.id);
      return quantity > 0 ? [{ stockItemId: item.id, quantity, unitPrice: previous?.unitPrice ?? item.price }] : [];
    });
    // Preserva peças históricas de produtos inativos que não aparecem no formulário.
    for (const part of editingOrder?.parts ?? []) if (!data.stock.some((item) => item.id === part.stockItemId)) parts.push(part);
    const record = { id: editingOrder?.id, version: editingOrder?.version, clientId: form.get("clientId"), device: form.get("device"), service: form.get("service"), status: form.get("status"), technician: form.get("technician"), dueDate: form.get("dueDate"), paymentMethod: form.get("paymentMethod"), paymentStatus: form.get("paymentStatus"), notes: form.get("notes"), parts, value: Number(form.get("value")) };
    if (record.status === "Cancelado" && !window.confirm("Cancelar esta ordem? As peças serão devolvidas ao estoque.")) return;
    if (await mutate("saveOrder", record)) { closeModal(); setActiveView("orders"); }
  };

  const deleteClient = async (client: Client) => {
    if (window.confirm("Excluir o cliente " + client.name + "?")) await mutate("deleteClient", { id: client.id, version: client.version });
  };
  const deleteStock = async (item: StockItem) => {
    if (window.confirm("Retirar " + item.name + " desta loja? O saldo precisa estar zerado.")) await mutate("deleteStock", { id: item.id, version: item.version, productVersion: item.productVersion });
  };
  const deleteOrder = async (order: ServiceOrder) => {
    if (window.confirm("Excluir a ordem " + order.id + "? As peças serão devolvidas ao estoque.")) await mutate("deleteOrder", { id: order.id, version: order.version });
  };
  const changeQuantity = async (id: string, amount: number) => { await mutate("quantity", { id, amount }); };
  const changeOrderStatus = async (id: string, status: OrderStatus) => {
    if (status === "Cancelado" && !window.confirm("Cancelar esta ordem e devolver as peças ao estoque?")) return;
    const order = data.orders.find((item) => item.id === id);
    if (order) await mutate("status", { id, status, version: order.version });
  };

  const printOrder = (order: ServiceOrder) => {
    const client = clientById.get(order.clientId);
    const popup = window.open("", "_blank", "width=900,height=700");
    if (!popup) {
      window.alert("O navegador bloqueou a impressão. Permita pop-ups para este site e tente novamente.");
      return;
    }

    const escapeHtml = (value: string) => value.replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" })[character] ?? character);
    const partsHtml = order.parts.length === 0 ? "<tr><td colspan='3'>Nenhuma peça utilizada</td></tr>" : order.parts.map((part) => `<tr><td>${escapeHtml(part.name)}</td><td>${part.quantity}</td><td>${escapeHtml(money(part.unitPrice * part.quantity))}</td></tr>`).join("");
    popup.document.write(`<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>${escapeHtml(order.id)} - Digital+</title><style>body{font:14px Arial,sans-serif;color:#171717;margin:36px}header{display:flex;justify-content:space-between;border-bottom:3px solid #e5007d;padding-bottom:18px;margin-bottom:24px}h1{margin:0;font-size:24px}h2{font-size:16px;margin:24px 0 10px}.grid{display:grid;grid-template-columns:1fr 1fr;gap:10px 28px}.box{padding:12px;background:#f5f5f7;border-radius:8px}.label{display:block;color:#666;font-size:11px;text-transform:uppercase;margin-bottom:4px}table{width:100%;border-collapse:collapse}th,td{padding:9px;border:1px solid #ddd;text-align:left}th{background:#f3f3f5}.total{text-align:right;font-size:18px;font-weight:700;margin-top:20px}.notes{white-space:pre-wrap}.signature{display:grid;grid-template-columns:1fr 1fr;gap:50px;margin-top:70px}.signature div{border-top:1px solid #333;text-align:center;padding-top:8px}@media print{body{margin:15mm}}</style></head><body><header><div><h1>Digital+ Acessórios</h1><div>Ordem de serviço ${escapeHtml(order.id)}</div></div><div>Emitido em ${escapeHtml(new Date().toLocaleString("pt-BR"))}</div></header><div class="grid"><div class="box"><span class="label">Cliente</span>${escapeHtml(client?.name ?? "Cliente removido")}</div><div class="box"><span class="label">Contato</span>${escapeHtml(client?.phone ?? "—")}</div><div class="box"><span class="label">Aparelho</span>${escapeHtml(order.device)}</div><div class="box"><span class="label">Status</span>${escapeHtml(order.status)}</div><div class="box"><span class="label">Técnico</span>${escapeHtml(order.technician || "Não definido")}</div><div class="box"><span class="label">Prazo</span>${escapeHtml(shortDate(order.dueDate))}</div></div><h2>Serviço ou defeito informado</h2><p>${escapeHtml(order.service)}</p><h2>Peças utilizadas</h2><table><thead><tr><th>Peça</th><th>Quantidade</th><th>Subtotal</th></tr></thead><tbody>${partsHtml}</tbody></table><h2>Pagamento</h2><p>${escapeHtml(order.paymentMethod)} · ${escapeHtml(order.paymentStatus)}</p>${order.notes ? `<h2>Observações</h2><p class="notes">${escapeHtml(order.notes)}</p>` : ""}<p class="total">Valor do serviço: ${escapeHtml(money(order.value))}</p><div class="signature"><div>Responsável pela assistência</div><div>Cliente</div></div><script>window.onload=()=>window.print();<\/script></body></html>`);
    popup.document.close();
  };

  const exportReports = () => {
    const period = reportStart || reportEnd ? `${reportStart ? shortDate(reportStart) : "Início"} a ${reportEnd ? shortDate(reportEnd) : "Hoje"}` : "Todos os registros";
    const rows = [
      ["RELATÓRIO DIGITAL+"],
      ["Gerado em", new Date().toLocaleString("pt-BR")],
      ["Período", period],
      ["Faturamento concluído", reportRevenue],
      ["Serviços concluídos", reportDeliveredOrders.length],
      ["Ordens no período", reportOrders.length],
      ["Produtos com estoque baixo", lowStock.length],
      [],
      ["PRODUTOS COM ESTOQUE BAIXO"],
      ["Produto", "SKU", "Quantidade", "Mínimo", "Custo", "Preço"],
      ...lowStock.map((item) => [item.name, item.sku, item.quantity, item.minimum, item.cost, item.price]),
      [],
      ["ORDENS DE SERVIÇO DO PERÍODO"],
      ["Ordem", "Cliente", "Aparelho", "Serviço", "Status", "Técnico", "Prazo", "Pagamento", "Situação do pagamento", "Peças utilizadas", "Valor", "Abertura"],
      ...reportOrders.map((order) => [order.id, clientById.get(order.clientId)?.name ?? "Cliente removido", order.device, order.service, order.status, order.technician, shortDate(order.dueDate), order.paymentMethod, order.paymentStatus, order.parts.map((part) => `${part.name} (${part.quantity})`).join(", "), order.value, shortDate(order.createdAt)]),
    ];
    const csv = `\uFEFF${rows.map((row) => row.map(safeCsv).join(";")).join("\n")}`;
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `relatorio-digital-mais-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const printReports = () => {
    const popup = window.open("", "_blank", "width=1000,height=760");
    if (!popup) {
      window.alert("O navegador bloqueou a exportação. Permita pop-ups para este site e tente novamente.");
      return;
    }
    const escapeHtml = (value: string) => value.replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" })[character] ?? character);
    const period = reportStart || reportEnd ? `${reportStart ? shortDate(reportStart) : "Início"} a ${reportEnd ? shortDate(reportEnd) : "Hoje"}` : "Todos os registros";
    const statusRows = ORDER_STATUSES.map((status) => `<tr><td>${escapeHtml(status)}</td><td>${reportOrders.filter((order) => order.status === status).length}</td></tr>`).join("");
    const stockRows = lowStock.length === 0 ? "<tr><td colspan='3'>Nenhum produto abaixo do mínimo.</td></tr>" : lowStock.map((item) => `<tr><td>${escapeHtml(item.name)}</td><td>${item.quantity}</td><td>${item.minimum}</td></tr>`).join("");
    popup.document.write(`<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>Relatório Digital+</title><style>body{font:14px Arial,sans-serif;color:#171717;margin:36px}header{border-bottom:3px solid #e5007d;padding-bottom:18px;margin-bottom:24px}h1{margin:0 0 6px}.period{color:#666}.kpis{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin:24px 0}.kpis div{padding:14px;background:#f4f4f7;border-radius:8px}.kpis span{display:block;color:#666;font-size:11px}.kpis strong{display:block;margin-top:6px;font-size:19px}section{margin-top:24px}h2{font-size:17px}table{width:100%;border-collapse:collapse}th,td{padding:9px;border:1px solid #ddd;text-align:left}th{background:#f3f3f5}@media print{body{margin:12mm}}</style></head><body><header><h1>Relatório Digital+ Acessórios</h1><div class="period">${escapeHtml(period)} · Gerado em ${escapeHtml(new Date().toLocaleString("pt-BR"))}</div></header><div class="kpis"><div><span>Faturamento concluído</span><strong>${escapeHtml(money(reportRevenue))}</strong></div><div><span>Serviços concluídos</span><strong>${reportDeliveredOrders.length}</strong></div><div><span>Ordens no período</span><strong>${reportOrders.length}</strong></div><div><span>Estoque baixo</span><strong>${lowStock.length}</strong></div></div><section><h2>Ordens por status</h2><table><thead><tr><th>Status</th><th>Quantidade</th></tr></thead><tbody>${statusRows}</tbody></table></section><section><h2>Produtos com estoque baixo</h2><table><thead><tr><th>Produto</th><th>Quantidade</th><th>Mínimo</th></tr></thead><tbody>${stockRows}</tbody></table></section><script>window.onload=()=>window.print();<\/script></body></html>`);
    popup.document.close();
  };

  const searchPlaceholder = activeView === "clients" ? "Buscar cliente..." : activeView === "stock" ? "Buscar produto ou SKU..." : "Buscar ordem, cliente ou aparelho...";
  const viewUsesSearch = activeView === "orders" || activeView === "clients" || activeView === "stock";

  return (
    <main className="dashboard-shell" aria-busy={busy}>
      <header className="dashboard-app-header">
        <div className="dashboard-app-header__main">
          <Link className="dashboard-brand" href="/" aria-label="Voltar ao site institucional">
            <img src="/digital-mais-logo.png" alt="Digital Mais Acessórios" />
            <span><strong>Digital+ ERP</strong><small>Assistência técnica</small></span>
          </Link>
          <div className="dashboard-operation-context" aria-label="Resumo da operação">
            <label>Unidade <select aria-label="Selecionar loja" value={storeId} disabled={busy} onChange={(event) => void switchStore(event.target.value)}>{stores.map((store) => <option key={store.id} value={store.id}>{store.name}</option>)}</select></label>
            <strong>{openOrders.length} atendimento(s) em andamento</strong>
          </div>
          <div className="dashboard-top-actions">
            <button className="dashboard-icon-button" type="button" onClick={toggleTheme} aria-label={theme === "dark" ? "Ativar tema claro" : "Ativar tema escuro"}><Icon name={theme === "dark" ? "sun" : "moon"} /></button>
            <button className={`dashboard-icon-button dashboard-notification ${activeView === "notifications" ? "dashboard-icon-button--active" : ""}`} type="button" onClick={() => changeView("notifications")} aria-label={`Abrir notificações: ${notificationCount} alerta(s)`}><Icon name="bell" />{notificationCount > 0 && <span>{notificationCount}</span>}</button>
            <details className="dashboard-account">
              <summary aria-label="Abrir opções da conta"><span className="profile-avatar">{initials || "DM"}</span><span><strong>{firstName}</strong><small>Equipe</small></span></summary>
              <div className="dashboard-account-menu">
                <div><strong>{name}</strong><small>{email}</small></div>
                <Link href="/"><Icon name="home" size={17} /> Site institucional</Link>
                <form method="post" action="/api/auth/logout"><button type="submit"><Icon name="logout" size={17} /> Sair da conta</button></form>
              </div>
            </details>
          </div>
        </div>
        <div className="dashboard-navigation-row">
          <nav className="dashboard-nav" aria-label="Módulos do sistema">
            {navItems.map((item) => (
              <button className={`dashboard-nav-link ${activeView === item.id ? "dashboard-nav-link--active" : ""}`} type="button" key={item.id} onClick={() => changeView(item.id)} aria-current={activeView === item.id ? "page" : undefined}>
                <Icon name={item.icon} size={18} /><span>{item.label}</span>
              </button>
            ))}
          </nav>
          {viewUsesSearch ? <div className="dashboard-search"><Icon name="search" size={18} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={searchPlaceholder} aria-label={searchPlaceholder} /></div> : <div className="dashboard-page-name"><span>Módulo atual</span><strong>{navItems.find((item) => item.id === activeView)?.label}</strong></div>}
        </div>
      </header>

      <section className="dashboard-workspace">
        <div className="dashboard-content">
          {hasLocalData && <aside className="system-feedback"><span>Existem dados da versão anterior salvos neste navegador. Eles ainda não foram transferidos para o banco.</span><button type="button" onClick={downloadLocalBackup}>Baixar cópia</button></aside>}
          {busy && <div className="system-feedback" role="status">Salvando ou carregando dados da equipe...</div>}
          {loadError && <div className="system-feedback" role="alert"><span>{loadError}</span><button type="button" disabled={busy} onClick={() => void switchStore(storeId)}>Atualizar dados</button></div>}
          {hydrated && stores.length === 0 && <div className="system-feedback" role="alert">Cadastre as unidades na tabela lojas do Supabase, com nome, endereço e ativo marcado, para iniciar os atendimentos.</div>}
          {systemMessage && <div className="system-feedback" role="status"><Icon name="bell" size={18} /><span>{systemMessage}</span><button type="button" onClick={() => setSystemMessage("")} aria-label="Fechar mensagem"><Icon name="close" size={16} /></button></div>}
          {!hydrated ? <div className="module-loading">{loadError ? "Aguardando conexão com o banco." : "Carregando seus dados..."}</div> : <>
            {activeView === "overview" && <Overview name={firstName} clients={data.clients} stock={data.stock} orders={data.orders} clientById={clientById} lowStock={lowStock} openOrders={openOrders} revenue={revenue} onNewOrder={() => openModal("order")} onView={changeView} onStatusView={openOrdersByStatus} />}
            {activeView === "orders" && <OrdersView orders={filteredOrders} clients={clientById} statusFilter={statusFilter} onStatusFilter={setStatusFilter} onNew={() => openModal("order")} onDetails={(id) => openModal("orderDetails", id)} onEdit={(id) => openModal("order", id)} onPrint={printOrder} onDelete={deleteOrder} onStatus={changeOrderStatus} />}
            {activeView === "clients" && <ClientsView clients={filteredClients} onNew={() => openModal("client")} onEdit={(id) => openModal("client", id)} onDelete={deleteClient} />}
            {activeView === "stock" && <StockView stock={filteredStock} onNew={() => openModal("stock")} onEdit={(id) => openModal("stock", id)} onDelete={deleteStock} onQuantity={changeQuantity} />}
            {activeView === "reports" && <ReportsView orders={reportOrders} stock={data.stock} lowStock={lowStock} clientsCount={data.clients.length} revenue={reportRevenue} projectedRevenue={reportProjectedRevenue} stockValue={stockValue} start={reportStart} end={reportEnd} onStart={setReportStart} onEnd={setReportEnd} onExport={exportReports} onPrint={printReports} />}
            {activeView === "notifications" && <NotificationsView lowStock={lowStock} readyOrders={readyOrders} waitingPieceOrders={waitingPieceOrders} clients={clientById} onView={changeView} />}
          </>}
        </div>
      </section>

      {modal && <div className="system-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) closeModal(); }}>
        <section className={`system-modal ${modal === "order" || modal === "orderDetails" ? "system-modal--wide" : ""}`} role="dialog" aria-modal="true" aria-labelledby="modal-title">
          <button className="system-modal-close" type="button" onClick={closeModal} aria-label="Fechar"><Icon name="close" /></button>
          <fieldset disabled={busy} style={{ border: 0, padding: 0, margin: 0, minWidth: 0 }}>
          {modal === "client" && <ClientForm client={editingClient} onSubmit={saveClient} />}
          {modal === "stock" && <StockForm item={editingStock} onSubmit={saveStock} />}
          {modal === "order" && <OrderForm clients={data.clients} stock={data.stock} order={editingOrder} onSubmit={saveOrder} />}
          {modal === "orderDetails" && editingOrder && <OrderDetails order={editingOrder} client={clientById.get(editingOrder.clientId)} onEdit={() => openModal("order", editingOrder.id)} onPrint={() => printOrder(editingOrder)} />}
          </fieldset>
        </section>
      </div>}
    </main>
  );
}

function PageHeader({ eyebrow, title, text, action }: { eyebrow: string; title: string; text: string; action?: React.ReactNode }) {
  const labels: Record<string, string> = {
    ATENDIMENTOS: "Atendimentos",
    RELACIONAMENTO: "Cadastro e histórico",
    "CONTROLE DE PEÇAS": "Peças e acessórios",
    ANÁLISE: "Resultados da operação",
    ACOMPANHAMENTO: "Pendências da equipe",
  };
  return <section className="module-header"><div><span>{labels[eyebrow] ?? eyebrow}</span><h1>{title}</h1><p>{text}</p></div>{action}</section>;
}

function EmptyState({ icon, title, text, action }: { icon: string; title: string; text: string; action?: React.ReactNode }) {
  return <div className="module-empty"><span><Icon name={icon} size={26} /></span><h3>{title}</h3><p>{text}</p>{action}</div>;
}

function Overview({ name, clients, stock, orders, clientById, lowStock, openOrders, revenue, onNewOrder, onView, onStatusView }: { name: string; clients: Client[]; stock: StockItem[]; orders: ServiceOrder[]; clientById: Map<string, Client>; lowStock: StockItem[]; openOrders: ServiceOrder[]; revenue: number; onNewOrder: () => void; onView: (view: View) => void; onStatusView: (status: OrderStatus) => void }) {
  const ready = orders.filter((order) => order.status === "Pronto").length;
  return <>
    <PageHeader eyebrow="Hoje na assistência" title={`Olá, ${name}.`} text="Veja o que precisa de atenção e continue os atendimentos de onde parou." action={<button className="dashboard-primary-action" type="button" onClick={onNewOrder}><Icon name="plus" size={18} /> Nova ordem de serviço</button>} />
    <section className="service-flow" aria-label="Fluxo das ordens de serviço">
      <div className="service-flow__intro"><span>Fluxo da oficina</span><strong>Acompanhe cada etapa</strong><small>Clique em uma etapa para abrir as ordens correspondentes.</small></div>
      <div className="service-flow__steps">
        {ORDER_STATUSES.map((status, index) => {
          const count = orders.filter((order) => order.status === status).length;
          return <button type="button" key={status} onClick={() => onStatusView(status)}><span>{String(index + 1).padStart(2, "0")}</span><div><strong>{status}</strong><small>{count} ordem(ns)</small></div></button>;
        })}
      </div>
    </section>
    <section className="dashboard-kpis" aria-label="Resumo do negócio">
      <article className="dashboard-kpi"><div><span>Ordens abertas</span><strong>{openOrders.length}</strong><small>{orders.length} ordens cadastradas</small></div><span className="kpi-mark kpi-mark--pink">OS</span></article>
      <article className="dashboard-kpi"><div><span>Clientes</span><strong>{clients.length}</strong><small>cadastros ativos</small></div><span className="kpi-mark kpi-mark--blue">CL</span></article>
      <article className="dashboard-kpi"><div><span>Prontas para retirada</span><strong>{ready}</strong><small>aguardando o cliente</small></div><span className="kpi-mark kpi-mark--green">PR</span></article>
      <article className="dashboard-kpi"><div><span>Faturamento concluído</span><strong>{money(revenue)}</strong><small>ordens marcadas como entregues</small></div><span className="kpi-mark kpi-mark--dark">R$</span></article>
    </section>
    <section className="dashboard-grid dashboard-grid--summary">
      <article className="dashboard-panel"><div className="dashboard-panel-head"><div><span>Atendimentos</span><h2>Ordens recentes</h2></div><button className="panel-link" type="button" onClick={() => onView("orders")}>Ver todas</button></div>{orders.length === 0 ? <EmptyState icon="file" title="Nenhuma ordem cadastrada" text="Crie a primeira ordem de serviço para acompanhar os atendimentos." action={<button className="text-action" type="button" onClick={onNewOrder}>Criar ordem</button>} /> : <div className="compact-list">{orders.slice(0, 5).map((order) => <div key={order.id}><div><strong>{order.id} · {clientById.get(order.clientId)?.name ?? "Cliente removido"}</strong><small>{order.device} — {order.service}</small></div><span className={statusClass(order.status)}>{order.status}</span></div>)}</div>}</article>
      <article className="dashboard-panel"><div className="dashboard-panel-head"><div><span>Estoque</span><h2>Itens para reposição</h2></div><button className="panel-link" type="button" onClick={() => onView("stock")}>Abrir estoque</button></div>{stock.length === 0 ? <EmptyState icon="box" title="Estoque vazio" text="Cadastre produtos para controlar quantidades e reposição." /> : lowStock.length === 0 ? <EmptyState icon="box" title="Estoque em dia" text="Nenhum item atingiu a quantidade mínima." /> : <div className="stock-alert-list">{lowStock.slice(0, 5).map((item) => <div className="stock-alert" key={item.id}><span className="stock-alert-icon">!</span><div><strong>{item.name}</strong><small>Mínimo: {item.minimum}</small></div><b>{item.quantity} un.</b></div>)}</div>}</article>
    </section>
  </>;
}

function OrdersView({ orders, clients, statusFilter, onStatusFilter, onNew, onDetails, onEdit, onPrint, onDelete, onStatus }: { orders: ServiceOrder[]; clients: Map<string, Client>; statusFilter: "Todos" | OrderStatus; onStatusFilter: (status: "Todos" | OrderStatus) => void; onNew: () => void; onDetails: (id: string) => void; onEdit: (id: string) => void; onPrint: (order: ServiceOrder) => void; onDelete: (order: ServiceOrder) => void; onStatus: (id: string, status: OrderStatus) => void }) {
  return <><PageHeader eyebrow="ATENDIMENTOS" title="Ordens de serviço" text="Crie, acompanhe, edite e finalize os serviços da assistência." action={<button className="dashboard-primary-action" type="button" onClick={onNew}><Icon name="plus" size={18} /> Nova ordem</button>} /><section className="dashboard-panel module-panel"><div className="module-toolbar"><label className="status-filter"><span>Filtrar por status</span><select value={statusFilter} onChange={(event) => onStatusFilter(event.target.value as "Todos" | OrderStatus)}><option>Todos</option>{ORDER_STATUSES.map((status) => <option key={status}>{status}</option>)}</select></label><span>{orders.length} registro(s)</span></div>{orders.length === 0 ? <EmptyState icon="file" title="Nenhuma ordem encontrada" text="Cadastre uma ordem ou altere os filtros de busca." action={<button className="text-action" type="button" onClick={onNew}>Criar ordem</button>} /> : <div className="orders-table-wrap"><table className="orders-table orders-table--service"><thead><tr><th>Ordem</th><th>Cliente</th><th>Aparelho / serviço</th><th>Status</th><th>Prazo</th><th>Pagamento</th><th>Valor</th><th>Ações</th></tr></thead><tbody>{orders.map((order) => <tr key={order.id}><td><strong>{order.id}</strong>{order.parts.length > 0 && <small>{order.parts.reduce((total, part) => total + part.quantity, 0)} peça(s)</small>}</td><td>{clients.get(order.clientId)?.name ?? "Cliente removido"}</td><td><strong>{order.device}</strong><small>{order.service}</small></td><td><select className={statusClass(order.status)} value={order.status} onChange={(event) => onStatus(order.id, event.target.value as OrderStatus)}>{ORDER_STATUSES.map((status) => <option key={status}>{status}</option>)}</select></td><td>{shortDate(order.dueDate)}</td><td><strong>{order.paymentStatus}</strong><small>{order.paymentMethod}</small></td><td>{money(order.value)}</td><td><div className="row-actions"><button className="row-action" type="button" onClick={() => onDetails(order.id)} aria-label={`Ver detalhes de ${order.id}`} title="Ver detalhes"><Icon name="eye" size={17} /></button><button className="row-action" type="button" onClick={() => onEdit(order.id)} aria-label={`Editar ${order.id}`} title="Editar"><Icon name="edit" size={17} /></button><button className="row-action" type="button" onClick={() => onPrint(order)} aria-label={`Imprimir ${order.id}`} title="Imprimir"><Icon name="print" size={17} /></button><button className="row-action row-action--danger" type="button" onClick={() => onDelete(order)} aria-label={`Excluir ${order.id}`} title="Excluir"><Icon name="trash" size={17} /></button></div></td></tr>)}</tbody></table></div>}</section></>;
}

function ClientsView({ clients, onNew, onEdit, onDelete }: { clients: Client[]; onNew: () => void; onEdit: (id: string) => void; onDelete: (client: Client) => void }) {
  return <><PageHeader eyebrow="RELACIONAMENTO" title="Clientes" text="Mantenha os dados de contato e identificação organizados." action={<button className="dashboard-primary-action" type="button" onClick={onNew}><Icon name="plus" size={18} /> Novo cliente</button>} /><section className="dashboard-panel module-panel"><div className="module-toolbar"><strong>Clientes cadastrados</strong><span>{clients.length} registro(s)</span></div>{clients.length === 0 ? <EmptyState icon="users" title="Nenhum cliente encontrado" text="Cadastre um cliente para iniciar uma ordem de serviço." action={<button className="text-action" type="button" onClick={onNew}>Cadastrar cliente</button>} /> : <div className="orders-table-wrap"><table className="orders-table"><thead><tr><th>Nome</th><th>Telefone</th><th>E-mail</th><th>CPF/CNPJ</th><th>Cadastro</th><th>Ações</th></tr></thead><tbody>{clients.map((client) => <tr key={client.id}><td><strong>{client.name}</strong></td><td>{client.phone}</td><td>{client.email || "—"}</td><td>{client.document || "—"}</td><td>{shortDate(client.createdAt)}</td><td><div className="row-actions"><button className="row-action" type="button" onClick={() => onEdit(client.id)} aria-label={`Editar ${client.name}`}><Icon name="edit" size={17} /></button><button className="row-action row-action--danger" type="button" onClick={() => onDelete(client)} aria-label={`Excluir ${client.name}`}><Icon name="trash" size={17} /></button></div></td></tr>)}</tbody></table></div>}</section></>;
}

function StockView({ stock, onNew, onEdit, onDelete, onQuantity }: { stock: StockItem[]; onNew: () => void; onEdit: (id: string) => void; onDelete: (item: StockItem) => void; onQuantity: (id: string, amount: number) => void }) {
  return <><PageHeader eyebrow="CONTROLE DE PEÇAS" title="Estoque" text="Cadastre produtos e registre entradas ou saídas de quantidade." action={<button className="dashboard-primary-action" type="button" onClick={onNew}><Icon name="plus" size={18} /> Novo produto</button>} /><section className="dashboard-panel module-panel"><div className="module-toolbar"><strong>Produtos cadastrados</strong><span>{stock.length} registro(s)</span></div>{stock.length === 0 ? <EmptyState icon="box" title="Nenhum produto encontrado" text="Adicione o primeiro item para começar o controle de estoque." action={<button className="text-action" type="button" onClick={onNew}>Adicionar produto</button>} /> : <div className="orders-table-wrap"><table className="orders-table"><thead><tr><th>Produto</th><th>SKU</th><th>Quantidade</th><th>Estoque mínimo</th><th>Custo</th><th>Venda</th><th>Ações</th></tr></thead><tbody>{stock.map((item) => <tr key={item.id}><td><strong>{item.name}</strong>{item.quantity <= item.minimum && <small className="danger-text">Reposição necessária</small>}</td><td>{item.sku || "—"}</td><td><div className="quantity-control"><button type="button" onClick={() => onQuantity(item.id, -1)} aria-label={`Retirar uma unidade de ${item.name}`}><Icon name="minus" size={14} /></button><strong>{item.quantity}</strong><button type="button" onClick={() => onQuantity(item.id, 1)} aria-label={`Adicionar uma unidade de ${item.name}`}><Icon name="plus" size={14} /></button></div></td><td>{item.minimum}</td><td>{money(item.cost)}</td><td>{money(item.price)}</td><td><div className="row-actions"><button className="row-action" type="button" onClick={() => onEdit(item.id)} aria-label={`Editar ${item.name}`}><Icon name="edit" size={17} /></button><button className="row-action row-action--danger" type="button" onClick={() => onDelete(item)} aria-label={`Excluir ${item.name}`}><Icon name="trash" size={17} /></button></div></td></tr>)}</tbody></table></div>}</section></>;
}

function ReportsView({ orders, stock, lowStock, clientsCount, revenue, projectedRevenue, stockValue, start, end, onStart, onEnd, onExport, onPrint }: { orders: ServiceOrder[]; stock: StockItem[]; lowStock: StockItem[]; clientsCount: number; revenue: number; projectedRevenue: number; stockValue: number; start: string; end: string; onStart: (value: string) => void; onEnd: (value: string) => void; onExport: () => void; onPrint: () => void }) {
  const maxCount = Math.max(1, ...ORDER_STATUSES.map((status) => orders.filter((order) => order.status === status).length));
  const deliveredCount = orders.filter((order) => order.status === "Entregue").length;

  return <>
    <PageHeader
      eyebrow="ANÁLISE"
      title="Relatórios"
      text="Filtre um período e exporte os resultados calculados a partir dos registros do sistema."
      action={<div className="report-actions">
        <button className="secondary-action" type="button" onClick={onPrint}><Icon name="print" size={18} /> Exportar PDF</button>
        <button className="dashboard-primary-action" type="button" onClick={onExport}><Icon name="download" size={18} /> Exportar CSV</button>
      </div>}
    />
    <section className="dashboard-panel report-filters" aria-label="Filtros do relatório">
      <label><span>Data inicial</span><input type="date" value={start} max={end || undefined} onChange={(event) => onStart(event.target.value)} /></label>
      <label><span>Data final</span><input type="date" value={end} min={start || undefined} onChange={(event) => onEnd(event.target.value)} /></label>
      <button type="button" className="text-action" onClick={() => { onStart(""); onEnd(""); }} disabled={!start && !end}>Limpar período</button>
      <strong>{orders.length} ordem(ns) no período</strong>
    </section>
    <section className="report-kpis">
      <article><span>Faturamento concluído</span><strong>{money(revenue)}</strong><small>Ordens entregues no período</small></article>
      <article><span>Valores previstos</span><strong>{money(projectedRevenue)}</strong><small>Todas as ordens do período</small></article>
      <article><span>Serviços concluídos</span><strong>{deliveredCount}</strong><small>Ordens entregues</small></article>
      <article><span>Estoque baixo</span><strong>{lowStock.length}</strong><small>Produtos no mínimo ou abaixo</small></article>
    </section>
    <section className="dashboard-grid dashboard-grid--summary">
      <article className="dashboard-panel">
        <div className="dashboard-panel-head"><div><span>ORDENS</span><h2>Distribuição por status</h2></div></div>
        {orders.length === 0 ? <EmptyState icon="chart" title="Sem dados no período" text="Altere as datas ou cadastre novas ordens de serviço." /> : <div className="report-bars">{ORDER_STATUSES.map((status) => {
          const count = orders.filter((order) => order.status === status).length;
          return <div key={status}><div><span>{status}</span><strong>{count}</strong></div><div className="report-bar-track"><span style={{ width: `${(count / maxCount) * 100}%` }} /></div></div>;
        })}</div>}
      </article>
      <article className="dashboard-panel">
        <div className="dashboard-panel-head"><div><span>ESTOQUE</span><h2>Produtos para reposição</h2></div><strong className="report-stock-value">{money(stockValue)}</strong></div>
        {lowStock.length === 0 ? <EmptyState icon="box" title="Estoque em dia" text="Nenhum produto atingiu a quantidade mínima." /> : <div className="report-low-stock">{lowStock.map((item) => <div key={item.id}><span><strong>{item.name}</strong><small>{item.sku || "Sem SKU"}</small></span><b>{item.quantity} / mín. {item.minimum}</b></div>)}</div>}
        <p className="report-context">{stock.length} produto(s) · {clientsCount} cliente(s) · valor atual do estoque {money(stockValue)}</p>
      </article>
    </section>
  </>;
}

function NotificationsView({ lowStock, readyOrders, waitingPieceOrders, clients, onView }: { lowStock: StockItem[]; readyOrders: ServiceOrder[]; waitingPieceOrders: ServiceOrder[]; clients: Map<string, Client>; onView: (view: View) => void }) {
  const total = lowStock.length + readyOrders.length + waitingPieceOrders.length;

  return <>
    <PageHeader eyebrow="ACOMPANHAMENTO" title="Notificações" text="Alertas gerados automaticamente pelos registros atuais do sistema." />
    <section className="dashboard-panel module-panel notification-panel">
      <div className="module-toolbar"><strong>Alertas ativos</strong><span>{total} notificação(ões)</span></div>
      {total === 0 ? <EmptyState icon="bell" title="Nenhuma notificação" text="O estoque está em dia e não há ordens aguardando atenção." /> : <div className="notification-list">
        {lowStock.map((item) => <article className="notification-item notification-item--warning" key={`stock-${item.id}`}>
          <span className="notification-item-icon"><Icon name="box" /></span>
          <div><strong>Reposição necessária</strong><p><b>{item.name}</b> está com {item.quantity} unidade(s); o mínimo definido é {item.minimum}.</p></div>
          <button type="button" className="panel-link" onClick={() => onView("stock")}>Ver estoque</button>
        </article>)}
        {waitingPieceOrders.map((order) => <article className="notification-item notification-item--info" key={`piece-${order.id}`}>
          <span className="notification-item-icon"><Icon name="file" /></span>
          <div><strong>Ordem aguardando peça</strong><p><b>{order.id}</b> · {clients.get(order.clientId)?.name ?? "Cliente removido"} — {order.device}.</p></div>
          <button type="button" className="panel-link" onClick={() => onView("orders")}>Ver ordem</button>
        </article>)}
        {readyOrders.map((order) => <article className="notification-item notification-item--success" key={`ready-${order.id}`}>
          <span className="notification-item-icon"><Icon name="file" /></span>
          <div><strong>Pronta para retirada</strong><p><b>{order.id}</b> · {clients.get(order.clientId)?.name ?? "Cliente removido"} — {order.device}.</p></div>
          <button type="button" className="panel-link" onClick={() => onView("orders")}>Ver ordem</button>
        </article>)}
      </div>}
    </section>
  </>;
}

function ClientForm({ client, onSubmit }: { client?: Client; onSubmit: (event: FormEvent<HTMLFormElement>) => void }) {
  return <><div className="system-modal-head"><span>CLIENTES</span><h2 id="modal-title">{client ? "Editar cliente" : "Novo cliente"}</h2><p>Preencha os dados principais do cliente.</p></div><form className="system-form" onSubmit={onSubmit}><label><span>Nome completo *</span><input name="name" defaultValue={client?.name} required maxLength={100} autoFocus /></label><div className="system-form-grid"><label><span>Telefone *</span><input name="phone" defaultValue={client?.phone} required maxLength={20} placeholder="(11) 99999-9999" /></label><label><span>CPF ou CNPJ</span><input name="document" defaultValue={client?.document} maxLength={20} /></label></div><label><span>E-mail</span><input name="email" type="email" defaultValue={client?.email} maxLength={120} /></label><button className="dashboard-primary-action" type="submit">{client ? "Salvar alterações" : "Cadastrar cliente"}</button></form></>;
}

function StockForm({ item, onSubmit }: { item?: StockItem; onSubmit: (event: FormEvent<HTMLFormElement>) => void }) {
  return <><div className="system-modal-head"><span>ESTOQUE</span><h2 id="modal-title">{item ? "Editar produto" : "Novo produto"}</h2><p>Defina os valores e a quantidade disponível.</p></div><form className="system-form" onSubmit={onSubmit}><div className="system-form-grid"><label><span>Nome do produto *</span><input name="name" defaultValue={item?.name} required maxLength={100} autoFocus /></label><label><span>SKU ou código</span><input name="sku" defaultValue={item?.sku} maxLength={40} /></label></div><div className="system-form-grid"><label><span>Quantidade *</span><input name="quantity" type="number" defaultValue={item?.quantity ?? 0} required min="0" step="1" /></label><label><span>Estoque mínimo *</span><input name="minimum" type="number" defaultValue={item?.minimum ?? 0} required min="0" step="1" /></label></div><div className="system-form-grid"><label><span>Custo unitário *</span><input name="cost" type="number" defaultValue={item?.cost ?? 0} required min="0" step="0.01" /></label><label><span>Preço de venda *</span><input name="price" type="number" defaultValue={item?.price ?? 0} required min="0" step="0.01" /></label></div><button className="dashboard-primary-action" type="submit">{item ? "Salvar alterações" : "Cadastrar produto"}</button></form></>;
}

function OrderForm({ clients, stock, order, onSubmit }: { clients: Client[]; stock: StockItem[]; order?: ServiceOrder; onSubmit: (event: FormEvent<HTMLFormElement>) => void }) {
  const existingParts = new Map((order?.parts ?? []).map((part) => [part.stockItemId, part.quantity]));

  return <>
    <div className="system-modal-head"><span>ATENDIMENTOS</span><h2 id="modal-title">{order ? `Editar ${order.id}` : "Nova ordem de serviço"}</h2><p>Registre atendimento, prazo, pagamento e peças utilizadas.</p></div>
    <form className="system-form order-form" onSubmit={onSubmit}>
      <fieldset><legend>Atendimento</legend>
        <label><span>Cliente *</span><select name="clientId" defaultValue={order?.clientId ?? ""} required autoFocus><option value="">Selecione um cliente</option>{clients.map((client) => <option value={client.id} key={client.id}>{client.name}</option>)}</select></label>
        <div className="system-form-grid"><label><span>Aparelho *</span><input name="device" defaultValue={order?.device} required maxLength={80} placeholder="Ex.: iPhone 13" /></label><label><span>Técnico responsável *</span><input name="technician" defaultValue={order?.technician} required maxLength={80} placeholder="Nome do técnico" /></label></div>
        <label><span>Defeito ou serviço solicitado *</span><textarea name="service" defaultValue={order?.service} required maxLength={300} rows={3} placeholder="Descreva o defeito relatado e o serviço solicitado" /></label>
        <div className="system-form-grid"><label><span>Status *</span><select name="status" defaultValue={order?.status ?? "Em análise"}>{ORDER_STATUSES.map((status) => <option key={status}>{status}</option>)}</select></label><label><span>Prazo de entrega *</span><input name="dueDate" type="date" defaultValue={order?.dueDate} required /></label></div>
      </fieldset>

      <fieldset><legend>Pagamento</legend>
        <div className="system-form-grid"><label><span>Forma de pagamento *</span><select name="paymentMethod" defaultValue={order?.paymentMethod ?? "A definir"}>{PAYMENT_METHODS.map((method) => <option key={method}>{method}</option>)}</select></label><label><span>Situação *</span><select name="paymentStatus" defaultValue={order?.paymentStatus ?? "Pendente"}>{PAYMENT_STATUSES.map((status) => <option key={status}>{status}</option>)}</select></label></div>
        <label><span>Valor total do serviço *</span><input name="value" type="number" required min="0" step="0.01" defaultValue={order?.value ?? 0} /></label>
      </fieldset>

      <fieldset><legend>Peças utilizadas</legend>
        {stock.length === 0 ? <p className="order-form-note">Nenhum produto cadastrado no estoque. A ordem poderá ser salva sem peças.</p> : <div className="order-parts-list">{stock.map((item) => {
          const currentQuantity = existingParts.get(item.id) ?? 0;
          const available = item.quantity + currentQuantity;
          return <label className="order-part-row" key={item.id}><span><strong>{item.name}</strong><small>{item.sku || "Sem SKU"} · {available} disponível(is)</small></span><input name={`part-${item.id}`} type="number" min="0" max={available} step="1" defaultValue={currentQuantity} aria-label={`Quantidade de ${item.name} utilizada`} /></label>;
        })}</div>}
        <p className="order-form-note">As quantidades informadas serão baixadas automaticamente do estoque ao salvar.</p>
      </fieldset>

      <fieldset><legend>Observações</legend><label><span>Informações adicionais</span><textarea name="notes" defaultValue={order?.notes} maxLength={800} rows={3} placeholder="Condições do aparelho, garantia, orientações ao cliente..." /></label></fieldset>
      <button className="dashboard-primary-action" type="submit">{order ? "Salvar alterações" : "Criar ordem de serviço"}</button>
    </form>
  </>;
}

function OrderDetails({ order, client, onEdit, onPrint }: { order: ServiceOrder; client?: Client; onEdit: () => void; onPrint: () => void }) {
  const partsTotal = order.parts.reduce((total, part) => total + part.quantity * part.unitPrice, 0);

  return <>
    <div className="system-modal-head order-details-head"><span>ORDEM DE SERVIÇO</span><h2 id="modal-title">{order.id}</h2><p>Criada em {dateTime(order.createdAt)} · Atualizada em {dateTime(order.updatedAt)}</p></div>
    <div className="order-details-actions"><button className="secondary-action" type="button" onClick={onEdit}><Icon name="edit" size={17} /> Editar ordem</button><button className="dashboard-primary-action" type="button" onClick={onPrint}><Icon name="print" size={17} /> Imprimir comprovante</button></div>
    <div className="order-details-grid">
      <section><span>Cliente</span><strong>{client?.name ?? "Cliente removido"}</strong><small>{client?.phone ?? "Sem telefone"}</small></section>
      <section><span>Aparelho</span><strong>{order.device}</strong><small>{order.service}</small></section>
      <section><span>Técnico responsável</span><strong>{order.technician || "Não definido"}</strong><small>Prazo: {shortDate(order.dueDate)}</small></section>
      <section><span>Status atual</span><strong>{order.status}</strong><small>{order.paymentStatus} · {order.paymentMethod}</small></section>
    </div>
    <div className="order-details-columns">
      <section className="order-details-section"><div className="order-details-title"><h3>Peças utilizadas</h3><strong>{money(partsTotal)}</strong></div>{order.parts.length === 0 ? <p className="order-details-empty">Nenhuma peça vinculada.</p> : <div className="order-detail-parts">{order.parts.map((part) => <div key={part.stockItemId}><span><strong>{part.name}</strong><small>{part.quantity} × {money(part.unitPrice)}</small></span><b>{money(part.quantity * part.unitPrice)}</b></div>)}</div>}</section>
      <section className="order-details-section"><div className="order-details-title"><h3>Histórico</h3></div>{order.history.length === 0 ? <p className="order-details-empty">Nenhuma alteração registrada.</p> : <ol className="order-history">{[...order.history].reverse().map((entry) => <li key={entry.id}><span /><div><strong>{entry.action}</strong><small>{dateTime(entry.at)}</small></div></li>)}</ol>}</section>
    </div>
    {order.notes && <section className="order-details-section order-notes"><div className="order-details-title"><h3>Observações</h3></div><p>{order.notes}</p></section>}
    <div className="order-details-total"><span>Valor total do serviço</span><strong>{money(order.value)}</strong></div>
  </>;
}
