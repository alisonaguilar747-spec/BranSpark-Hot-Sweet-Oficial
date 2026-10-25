/* BrandSpark: Hot & Sweet — lógica completa */
(() => {
  "use strict";

  const KEY = "brandspark_hot_sweet_v1";

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

  const today = () => new Date().toISOString().slice(0, 10);

  const money = value =>
    new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD"
    }).format(Number(value) || 0);

  const clean = value => String(value ?? "").trim();
  const norm = value => clean(value).toLocaleLowerCase("es");

  const uid = () =>
    `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;

  const escapeHTML = value =>
    String(value ?? "").replace(/[&<>"']/g, c => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;"
    }[c]));

  const initial = {
    inventory: [],
    stock: [],
    sales: [],
    finance: [],
    files: []
  };

  function load() {
    try {
      const parsed = JSON.parse(localStorage.getItem(KEY) || "{}");
      return { ...structuredClone(initial), ...parsed };
    } catch {
      return structuredClone(initial);
    }
  }

  let db = load();

  function save() {
    try {
      localStorage.setItem(KEY, JSON.stringify(db));
    } catch (error) {
      toast(
        "No se pudo guardar. Puede que el navegador esté sin espacio; " +
        "descarga un respaldo y reduce el tamaño de los archivos."
      );
      throw error;
    }
  }

  function toast(message) {
    const node = $("#toast");
    node.textContent = message;
    node.classList.add("show");

    clearTimeout(toast.timer);
    toast.timer = setTimeout(() => node.classList.remove("show"), 3500);
  }

  function companyMatch(record, filter) {
    return !clean(filter) || norm(record).includes(norm(filter));
  }

  function dateInRange(date, from, to) {
    return (!from || date >= from) && (!to || date <= to);
  }

  function findProduct(company, product) {
    return db.inventory.find(p =>
      norm(p.company) === norm(company) &&
      norm(p.productName) === norm(product)
    );
  }

  function rowActions(type, id) {
    return `
      <div class="table-actions">
        <button class="action-btn" type="button"
          data-action="edit-${type}" data-id="${escapeHTML(id)}">
          Editar
        </button>
        <button class="action-btn danger" type="button"
          data-action="delete-${type}" data-id="${escapeHTML(id)}">
          Eliminar
        </button>
      </div>
    `;
  }

  function emptyRow(colspan, message = "Todavía no hay registros.") {
    return `
      <tr>
        <td class="empty" colspan="${colspan}">${message}</td>
      </tr>
    `;
  }

  function resetForm(form) {
    form.reset();

    if (form.elements.id) {
      form.elements.id.value = "";
    }
  }

  function formObject(form) {
    return Object.fromEntries(new FormData(form).entries());
  }

  function setDefaultDates() {
    $$('input[type="date"]').forEach(input => {
      if (!input.value) input.value = today();
    });
  }

  // INVENTARIO

  function renderInventory() {
    const search = norm($("#inventorySearch").value);
    const company = clean($("#inventoryCompanyFilter").value);
    const status = $("#inventoryStatusFilter").value;
    const threshold = Math.max(
      0,
      Number($("#lowStockThreshold").value) || 0
    );

    const list = db.inventory.filter(p =>
      `${p.company} ${p.productName} ${p.category}`
        .toLocaleLowerCase("es")
        .includes(search) &&
      companyMatch(p.company, company) &&
      (
        status === "all" ||
        (
          status === "low"
            ? Number(p.quantity) <= threshold
            : Number(p.quantity) > threshold
        )
      )
    );

    $("#productCount").textContent = db.inventory.length;

    $("#unitCount").textContent = db.inventory.reduce(
      (sum, p) => sum + Number(p.quantity || 0),
      0
    );

    $("#inventoryValue").textContent = money(
      db.inventory.reduce(
        (sum, p) =>
          sum + Number(p.quantity || 0) * Number(p.price || 0),
        0
      )
    );

    const low = db.inventory.filter(
      p => Number(p.quantity) <= threshold
    );

    const alert = $("#lowStockAlert");
    alert.hidden = !low.length;

    alert.textContent = low.length
      ? `⚠ ${low.length} producto(s) con existencias bajas: ${
          low.map(p => `${p.productName} (${p.company}: ${p.quantity})`).join(", ")
        }.`
      : "";

    $("#inventoryRows").innerHTML = list.length
      ? list.map(p => `
          <tr>
            <td>${escapeHTML(p.company)}</td>
            <td><strong>${escapeHTML(p.productName)}</strong></td>
            <td>${escapeHTML(p.category || "—")}</td>
            <td>${Number(p.quantity)}</td>
            <td>${money(p.price)}</td>
            <td>${money(Number(p.quantity) * Number(p.price))}</td>
            <td>${rowActions("inventory", p.id)}</td>
          </tr>
        `).join("")
      : emptyRow(7, "No hay productos que coincidan con la búsqueda.");
  }

  function submitInventory(event) {
    event.preventDefault();

    const form = event.currentTarget;
    const data = formObject(form);
    const quantity = Number(data.quantity);
    const price = Number(data.price);

    if (
      !clean(data.company) ||
      !clean(data.productName) ||
      quantity < 0 ||
      price < 0
    ) {
      return toast("Revisa los datos del producto.");
    }

    if (data.id) {
      const old = db.inventory.find(p => p.id === data.id);
      if (!old) return;

      Object.assign(old, {
        company: clean(data.company),
        productName: clean(data.productName),
        quantity,
        price,
        category: clean(data.category)
      });

      toast("Producto actualizado.");
    } else {
      if (findProduct(data.company, data.productName)) {
        return toast(
          "Ese producto ya existe para ese emprendimiento. " +
          "Edita el registro existente."
        );
      }

      db.inventory.push({
        id: uid(),
        company: clean(data.company),
        productName: clean(data.productName),
        quantity,
        price,
        category: clean(data.category),
        createdAt: Date.now()
      });

      toast("Producto guardado.");
    }

    save();
    resetForm(form);

    $("#inventoryFormTitle").textContent =
      "Agregar producto o ingrediente";

    $("#cancelInventoryEdit").hidden = true;
    renderAll();
  }

  // MOVIMIENTOS DE INVENTARIO

  function renderStock() {
    const list = db.stock
      .slice()
      .sort((a, b) => b.createdAt - a.createdAt);

    $("#stockRows").innerHTML = list.length
      ? list.map(m => `
          <tr>
            <td>${escapeHTML(m.date)}</td>
            <td>${escapeHTML(m.company)}</td>
            <td>${escapeHTML(m.productName)}</td>
            <td>${escapeHTML(m.movementType)}</td>
            <td>${Number(m.quantity)}</td>
            <td>${escapeHTML(m.note || "—")}</td>
            <td>
              ${
                m.source === "sale"
                  ? '<span class="pill">Vinculado a venta</span>'
                  : rowActions("stock", m.id)
              }
            </td>
          </tr>
        `).join("")
      : emptyRow(7);
  }

  function submitStock(event) {
    event.preventDefault();

    const form = event.currentTarget;
    const data = formObject(form);
    const type = norm(data.movementType);

    const isIn = [
      "entrada",
      "ingreso",
      "compra",
      "entrada de inventario"
    ].includes(type);

    const isOut = [
      "salida",
      "egreso",
      "uso",
      "consumo"
    ].includes(type);

    if (!isIn && !isOut) {
      return toast('En tipo de movimiento escribe "entrada" o "salida".');
    }

    const quantity = Number(data.quantity);
    const product = findProduct(data.company, data.productName);

    if (!product) {
      return toast(
        "No se encontró ese producto en el inventario. " +
        "Regístralo primero con el mismo nombre y emprendimiento."
      );
    }

    if (!Number.isInteger(quantity) || quantity < 1) {
      return toast("La cantidad debe ser un número entero mayor que cero.");
    }

    const old = data.id
      ? db.stock.find(m => m.id === data.id)
      : null;

    if (data.id && !old) return;

    if (old) {
      const oldProduct = findProduct(old.company, old.productName);

      if (oldProduct) {
        oldProduct.quantity += old.movementType === "Entrada"
          ? Number(old.quantity)
          : -Number(old.quantity);
      }

      db.stock = db.stock.filter(m => m.id !== old.id);
    }

    if (isOut && product.quantity < quantity) {
      if (old) {
        const oldProduct = findProduct(old.company, old.productName);

        if (oldProduct) {
          oldProduct.quantity -= old.movementType === "Entrada"
            ? Number(old.quantity)
            : -Number(old.quantity);
        }

        db.stock.push(old);
      }

      return toast("No hay existencias suficientes para registrar esa salida.");
    }

    product.quantity += isIn ? quantity : -quantity;

    db.stock.push({
      id: old?.id || uid(),
      company: clean(data.company),
      productName: clean(data.productName),
      movementType: isIn ? "Entrada" : "Salida",
      quantity,
      note: clean(data.note),
      date: today(),
      createdAt: Date.now()
    });

    save();
    resetForm(form);
    $("#cancelStockEdit").hidden = true;
    renderAll();
    toast("Movimiento de inventario guardado.");
  }

  // VENTAS

  function updateSalePreview() {
    const form = $("#salesForm");
    const quantity = Number(form.elements.quantity.value) || 0;
    const price = Number(form.elements.price.value) || 0;

    $("#saleTotalPreview").textContent = money(quantity * price);
  }

  function renderSales() {
    const search = norm($("#salesSearch").value);
    const company = clean($("#salesCompanyFilter").value);
    const from = $("#salesFrom").value;
    const to = $("#salesTo").value;

    const list = db.sales
      .filter(s =>
        `${s.company} ${s.productName} ${s.note || ""} ${s.date}`
          .toLocaleLowerCase("es")
          .includes(search) &&
        companyMatch(s.company, company) &&
        dateInRange(s.date, from, to)
      )
      .sort((a, b) => b.date.localeCompare(a.date));

    $("#salesTotalBadge").textContent = money(
      list.reduce((sum, s) => sum + Number(s.total), 0)
    );

    $("#salesRows").innerHTML = list.length
      ? list.map(s => `
          <tr>
            <td>${escapeHTML(s.date)}</td>
            <td>${escapeHTML(s.company)}</td>
            <td>${escapeHTML(s.productName)}</td>
            <td>${Number(s.quantity)}</td>
            <td>${money(s.price)}</td>
            <td><strong>${money(s.total)}</strong></td>
            <td>${rowActions("sale", s.id)}</td>
          </tr>
        `).join("")
      : emptyRow(7);

    updateSalePreview();
  }

  function submitSale(event) {
    event.preventDefault();

    const form = event.currentTarget;
    const data = formObject(form);

    const company = clean(data.company);
    const productName = clean(data.productName);
    const quantity = Number(data.quantity);
    const price = Number(data.price);

    const product = findProduct(company, productName);

    if (
      !company ||
      !productName ||
      !data.date ||
      !Number.isInteger(quantity) ||
      quantity < 1 ||
      price <= 0
    ) {
      return toast("Completa los datos de la venta con valores válidos.");
    }

    const old = data.id
      ? db.sales.find(s => s.id === data.id)
      : null;

    if (data.id && !old) return;

    if (!product) {
      return toast(
        "No se encontró el producto en el inventario. " +
        "Regístralo primero con el mismo nombre y emprendimiento."
      );
    }

    if (old) {
      const oldProduct = findProduct(old.company, old.productName);

      if (oldProduct) {
        oldProduct.quantity += Number(old.quantity);
      }

      db.sales = db.sales.filter(s => s.id !== old.id);
      db.finance = db.finance.filter(m => m.id !== old.financeId);
      db.stock = db.stock.filter(m => m.id !== old.stockId);
    }

    if (product.quantity < quantity) {
      if (old) {
        const oldProduct = findProduct(old.company, old.productName);

        if (oldProduct) {
          oldProduct.quantity -= Number(old.quantity);
        }

        db.sales.push(old);

        if (
          old.financeId &&
          !db.finance.some(x => x.id === old.financeId)
        ) {
          db.finance.push({
            id: old.financeId,
            company: old.company,
            type: "ingreso",
            date: old.date,
            concept: `Venta: ${old.productName} × ${old.quantity}`,
            amount: old.total,
            source: "sale",
            saleId: old.id,
            createdAt: old.createdAt
          });
        }

        if (
          old.stockId &&
          !db.stock.some(x => x.id === old.stockId)
        ) {
          db.stock.push({
            id: old.stockId,
            company: old.company,
            productName: old.productName,
            movementType: "Salida",
            quantity: old.quantity,
            note: "Venta registrada",
            date: old.date,
            createdAt: old.createdAt,
            source: "sale"
          });
        }
      }

      return toast(
        `Existencias insuficientes. Disponibles: ${product.quantity}.`
      );
    }

    product.quantity -= quantity;

    const saleId = old?.id || uid();
    const financeId = uid();
    const stockId = uid();
    const total = quantity * price;

    db.sales.push({
      id: saleId,
      company,
      productName,
      date: data.date,
      quantity,
      price,
      total,
      note: clean(data.note),
      financeId,
      stockId,
      createdAt: old?.createdAt || Date.now()
    });

    db.finance.push({
      id: financeId,
      company,
      type: "ingreso",
      date: data.date,
      concept: `Venta: ${productName} × ${quantity}`,
      amount: total,
      source: "sale",
      saleId,
      createdAt: Date.now()
    });

    db.stock.push({
      id: stockId,
      company,
      productName,
      movementType: "Salida",
      quantity,
      note: `Venta registrada${data.note ? ": " + clean(data.note) : ""}`,
      date: data.date,
      createdAt: Date.now(),
      source: "sale"
    });

    save();
    resetForm(form);

    form.elements.date.value = today();
    form.elements.quantity.value = 1;

    $("#salesFormTitle").textContent = "Registrar una venta";
    $("#cancelSaleEdit").hidden = true;

    renderAll();
    toast("Venta guardada; inventario e ingreso actualizados.");
  }

  // INGRESOS Y EGRESOS

  function normalizeType(value) {
    const type = norm(value);

    if ([
      "ingreso",
      "ingresos",
      "venta",
      "entrada",
      "cobro"
    ].includes(type)) {
      return "ingreso";
    }

    if ([
      "egreso",
      "egresos",
      "gasto",
      "gastos",
      "salida",
      "compra",
      "pago"
    ].includes(type)) {
      return "egreso";
    }

    return "";
  }

  function renderFinance() {
    const search = norm($("#financeSearch").value);
    const company = clean($("#financeCompanyFilter").value);
    const type = $("#financeTypeFilter").value;

    const list = db.finance
      .filter(f =>
        `${f.company} ${f.type} ${f.concept} ${f.date}`
          .toLocaleLowerCase("es")
          .includes(search) &&
        companyMatch(f.company, company) &&
        (type === "all" || f.type === type)
      )
      .sort((a, b) => b.date.localeCompare(a.date));

    const income = db.finance
      .filter(f => f.type === "ingreso")
      .reduce((sum, f) => sum + Number(f.amount), 0);

    const expense = db.finance
      .filter(f => f.type === "egreso")
      .reduce((sum, f) => sum + Number(f.amount), 0);

    $("#financeBalance").textContent =
      `Balance: ${money(income - expense)}`;

    $("#financeRows").innerHTML = list.length
      ? list.map(f => `
          <tr>
            <td>${escapeHTML(f.date)}</td>
            <td>${escapeHTML(f.company)}</td>
            <td>${f.type === "ingreso" ? "Ingreso" : "Egreso"}</td>
            <td>${escapeHTML(f.concept)}</td>
            <td>${money(f.amount)}</td>
            <td>
              ${
                f.source === "sale"
                  ? "Vinculado a venta"
                  : rowActions("finance", f.id)
              }
            </td>
          </tr>
        `).join("")
      : emptyRow(6);
  }

  function submitFinance(event) {
    event.preventDefault();

    const form = event.currentTarget;
    const data = formObject(form);
    const type = normalizeType(data.type);
    const amount = Number(data.amount);

    if (!type) {
      return toast('En tipo de movimiento escribe "ingreso" o "egreso".');
    }

    if (
      !clean(data.company) ||
      !clean(data.concept) ||
      !data.date ||
      amount <= 0
    ) {
      return toast("Completa todos los datos financieros correctamente.");
    }

    if (data.id) {
      const old = db.finance.find(x => x.id === data.id);

      if (!old || old.source === "sale") {
        return toast(
          "Ese movimiento está vinculado a una venta y se modifica desde Registro de ventas."
        );
      }

      Object.assign(old, {
        company: clean(data.company),
        type,
        date: data.date,
        concept: clean(data.concept),
        amount
      });

      toast("Movimiento financiero actualizado.");
    } else {
      db.finance.push({
        id: uid(),
        company: clean(data.company),
        type,
        date: data.date,
        concept: clean(data.concept),
        amount,
        source: "manual",
        createdAt: Date.now()
      });

      toast("Movimiento financiero guardado.");
    }

    save();
    resetForm(form);

    form.elements.date.value = today();

    $("#financeFormTitle").textContent =
      "Registrar ingreso o egreso";

    $("#cancelFinanceEdit").hidden = true;
    renderAll();
  }

  // ARCHIVOS DIGITALES

  function renderFiles() {
    const list = db.files
      .slice()
      .sort((a, b) => b.createdAt - a.createdAt);

    $("#fileRows").innerHTML = list.length
      ? list.map(f => `
          <tr>
            <td>${escapeHTML(f.date)}</td>
            <td>${escapeHTML(f.company)}</td>
            <td>${escapeHTML(f.description || "Documento")}</td>
            <td>${escapeHTML(f.name)}</td>
            <td>
              <div class="table-actions">
                <button class="action-btn" type="button"
                  data-action="open-file" data-id="${escapeHTML(f.id)}">
                  Abrir
                </button>
                <button class="action-btn" type="button"
                  data-action="download-file" data-id="${escapeHTML(f.id)}">
                  Descargar
                </button>
                <button class="action-btn danger" type="button"
                  data-action="delete-file" data-id="${escapeHTML(f.id)}">
                  Eliminar
                </button>
              </div>
            </td>
          </tr>
        `).join("")
      : emptyRow(5);
  }

  function submitFile(event) {
    event.preventDefault();

    const form = event.currentTarget;
    const data = formObject(form);
    const file = form.elements.file.files[0];

    if (!file) return toast("Selecciona un archivo.");

    const reader = new FileReader();

    reader.onload = () => {
      const item = {
        id: uid(),
        company: clean(data.company),
        description: clean(data.description),
        name: file.name,
        type: file.type || "application/octet-stream",
        size: file.size,
        dataUrl: reader.result,
        date: today(),
        createdAt: Date.now()
      };

      db.files.push(item);

      try {
        save();
        resetForm(form);
        renderFiles();
        toast("Documento guardado.");
      } catch {
        db.files = db.files.filter(x => x.id !== item.id);
      }
    };

    reader.onerror = () => toast("No se pudo leer el archivo.");
    reader.readAsDataURL(file);
  }

  function openFile(id, download = false) {
    const file = db.files.find(item => item.id === id);
    if (!file) return;

    const link = document.createElement("a");
    link.href = file.dataUrl;
    link.target = "_blank";
    link.rel = "noopener";

    if (download) link.download = file.name;

    document.body.append(link);
    link.click();
    link.remove();
  }

  // REPORTES

  function renderReport() {
    const company = clean($("#reportCompany").value);
    const from = $("#reportFrom").value;
    const to = $("#reportTo").value;

    const sales = db.sales.filter(s =>
      companyMatch(s.company, company) &&
      dateInRange(s.date, from, to)
    );

    const finance = db.finance.filter(f =>
      companyMatch(f.company, company) &&
      dateInRange(f.date, from, to)
    );

    const totalSales = sales.reduce(
      (sum, s) => sum + Number(s.total),
      0
    );

    const income = finance
      .filter(f => f.type === "ingreso")
      .reduce((sum, f) => sum + Number(f.amount), 0);

    const expense = finance
      .filter(f => f.type === "egreso")
      .reduce((sum, f) => sum + Number(f.amount), 0);

    $("#reportSales").textContent = money(totalSales);
    $("#reportIncome").textContent = money(income);
    $("#reportExpense").textContent = money(expense);
    $("#reportBalance").textContent = money(income - expense);

    const companies = [
      ...new Set([
        ...sales.map(s => s.company),
        ...finance.map(f => f.company)
      ])
    ].sort((a, b) => a.localeCompare(b, "es"));

    $("#reportRows").innerHTML = companies.length
      ? companies.map(name => {
          const companySales = sales.filter(
            s => norm(s.company) === norm(name)
          );

          const companyFinance = finance.filter(
            f => norm(f.company) === norm(name)
          );

          const salesValue = companySales.reduce(
            (sum, s) => sum + Number(s.total),
            0
          );

          const incomeValue = companyFinance
            .filter(f => f.type === "ingreso")
            .reduce((sum, f) => sum + Number(f.amount), 0);

          const expenseValue = companyFinance
            .filter(f => f.type === "egreso")
            .reduce((sum, f) => sum + Number(f.amount), 0);

          return `
            <tr>
              <td>${escapeHTML(name)}</td>
              <td>${money(salesValue)}</td>
              <td>${money(incomeValue)}</td>
              <td>${money(expenseValue)}</td>
              <td>${money(incomeValue - expenseValue)}</td>
            </tr>
          `;
        }).join("")
      : emptyRow(5, "No hay movimientos en este período.");
  }

  // EXPORTACIÓN Y RESPALDO

  function downloadBlob(blob, name) {
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = name;

    document.body.append(link);
    link.click();
    link.remove();

    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function exportCSV() {
    const company = clean($("#reportCompany").value);
    const from = $("#reportFrom").value;
    const to = $("#reportTo").value;

    const sales = db.sales.filter(s =>
      companyMatch(s.company, company) &&
      dateInRange(s.date, from, to)
    );

    const finance = db.finance.filter(f =>
      companyMatch(f.company, company) &&
      dateInRange(f.date, from, to)
    );

    const rows = [[
      "Tipo",
      "Fecha",
      "Emprendimiento",
      "Concepto",
      "Cantidad",
      "Precio unitario",
      "Importe"
    ]];

    sales.forEach(s => rows.push([
      "Venta",
      s.date,
      s.company,
      `${s.productName}${s.note ? " - " + s.note : ""}`,
      s.quantity,
      s.price,
      s.total
    ]));

    finance
      .filter(f => f.source !== "sale")
      .forEach(f => rows.push([
        f.type,
        f.date,
        f.company,
        f.concept,
        "",
        "",
        f.amount
      ]));

    const csv = "\ufeff" + rows.map(row =>
      row.map(value =>
        `"${String(value ?? "").replace(/"/g, '""')}"`
      ).join(",")
    ).join("\r\n");

    downloadBlob(
      new Blob([csv], { type: "text/csv;charset=utf-8;" }),
      "BrandSpark_reporte.csv"
    );
  }

  function exportBackup() {
    const backup = {
      ...db,
      backupCreatedAt: new Date().toISOString(),
      app: "BrandSpark: Hot & Sweet"
    };

    downloadBlob(
      new Blob([JSON.stringify(backup, null, 2)], {
        type: "application/json"
      }),
      `BrandSpark_respaldo_${today()}.json`
    );

    toast("Respaldo descargado.");
  }

  function importBackup(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();

    reader.onload = () => {
      try {
        const parsed = JSON.parse(reader.result);

        for (const key of Object.keys(initial)) {
          if (!Array.isArray(parsed[key])) {
            throw new Error("Formato incorrecto");
          }
        }

        if (!confirm(
          "Esto reemplazará los datos actuales por los del respaldo. ¿Deseas continuar?"
        )) {
          return;
        }

        db = {
          inventory: parsed.inventory,
          stock: parsed.stock,
          sales: parsed.sales,
          finance: parsed.finance,
          files: parsed.files
        };

        save();
        renderAll();
        toast("Respaldo recuperado correctamente.");
      } catch {
        toast(
          "No se pudo recuperar el archivo. Selecciona un respaldo JSON de BrandSpark."
        );
      } finally {
        event.target.value = "";
      }
    };

    reader.readAsText(file);
  }

  // EDICIÓN Y ELIMINACIÓN

  function editRecord(type, id) {
    const map = {
      inventory: [
        "inventoryForm", "inventory",
        "inventoryFormTitle", "Agregar producto o ingrediente",
        "cancelInventoryEdit"
      ],
      stock: [
        "stockForm", "stock",
        null, null,
        "cancelStockEdit"
      ],
      sale: [
        "salesForm", "sales",
        "salesFormTitle", "Registrar una venta",
        "cancelSaleEdit"
      ],
      finance: [
        "financeForm", "finance",
        "financeFormTitle", "Registrar ingreso o egreso",
        "cancelFinanceEdit"
      ]
    };

    const config = map[type];
    if (!config) return;

    const [formId, key, titleId, title, cancelId] = config;
    const record = db[key].find(item => item.id === id);
    if (!record) return;

    const form = $(`#${formId}`);

    Object.entries(record).forEach(([key, value]) => {
      if (form.elements[key]) {
        form.elements[key].value = value;
      }
    });

    if (type === "stock") {
      form.elements.movementType.value = record.movementType;
    }

    if (type === "sale") {
      form.elements.quantity.value = record.quantity;
      form.elements.price.value = record.price;
      updateSalePreview();
    }

    if (titleId) {
      $(`#${titleId}`).textContent = "Editar registro";
    }

    $(`#${cancelId}`).hidden = false;
    form.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  function deleteRecord(type, id) {
    if (!confirm(
      "¿Seguro que deseas eliminar este registro? Esta acción no se puede deshacer."
    )) {
      return;
    }

    if (type === "inventory") {
      const product = db.inventory.find(p => p.id === id);

      if (
        product &&
        (
          db.sales.some(s =>
            norm(s.company) === norm(product.company) &&
            norm(s.productName) === norm(product.productName)
          ) ||
          db.stock.some(s =>
            norm(s.company) === norm(product.company) &&
            norm(s.productName) === norm(product.productName)
          )
        )
      ) {
        return toast(
          "No puedes eliminar un producto con movimientos asociados. " +
          "Elimina o conserva sus movimientos primero."
        );
      }

      db.inventory = db.inventory.filter(p => p.id !== id);
    }

    else if (type === "stock") {
      const movement = db.stock.find(m => m.id === id);

      if (movement?.source === "sale") {
        return toast(
          "Este movimiento está vinculado a una venta. " +
          "Modifica la venta desde su apartado."
        );
      }

      if (movement) {
        const product = findProduct(
          movement.company,
          movement.productName
        );

        if (product) {
          product.quantity += movement.movementType === "Entrada"
            ? -Number(movement.quantity)
            : Number(movement.quantity);
        }

        db.stock = db.stock.filter(m => m.id !== id);
      }
    }

    else if (type === "sale") {
      const sale = db.sales.find(s => s.id === id);

      if (sale) {
        const product = findProduct(sale.company, sale.productName);

        if (product) {
          product.quantity += Number(sale.quantity);
        }

        db.finance = db.finance.filter(
          f => f.id !== sale.financeId
        );

        db.stock = db.stock.filter(
          m => m.id !== sale.stockId
        );

        db.sales = db.sales.filter(s => s.id !== id);
      }
    }

    else if (type === "finance") {
      const finance = db.finance.find(f => f.id === id);

      if (finance?.source === "sale") {
        return toast(
          "Este ingreso está vinculado a una venta. " +
          "Elimina o edita la venta desde su apartado."
        );
      }

      db.finance = db.finance.filter(f => f.id !== id);
    }

    save();
    renderAll();
    toast("Registro eliminado.");
  }

  // MANUAL: ABRIR, CERRAR E IMPRIMIR

  function openManual() {
    const overlay = $("#manualOverlay");

    overlay.hidden = false;
    document.body.classList.add("modal-open");

    $(".manual-modal", overlay).focus();
    $("#manualClose").focus();
  }

  function closeManual() {
    $("#manualOverlay").hidden = true;
    document.body.classList.remove("modal-open");
    $("#openManual").focus();
  }

  // ACTUALIZACIÓN GENERAL

  function renderAll() {
    renderInventory();
    renderStock();
    renderSales();
    renderFinance();
    renderFiles();
    renderReport();
  }

  // CONECTAR LOS FORMULARIOS

  $("#inventoryForm").addEventListener("submit", submitInventory);
  $("#stockForm").addEventListener("submit", submitStock);
  $("#salesForm").addEventListener("submit", submitSale);
  $("#financeForm").addEventListener("submit", submitFinance);
  $("#fileForm").addEventListener("submit", submitFile);

  // BÚSQUEDAS Y FILTROS

  [
    "inventorySearch",
    "inventoryCompanyFilter",
    "inventoryStatusFilter",
    "lowStockThreshold"
  ].forEach(id => {
    $(`#${id}`).addEventListener("input", renderInventory);
  });

  [
    "salesSearch",
    "salesCompanyFilter",
    "salesFrom",
    "salesTo"
  ].forEach(id => {
    $(`#${id}`).addEventListener("input", renderSales);
  });

  [
    "financeSearch",
    "financeCompanyFilter",
    "financeTypeFilter"
  ].forEach(id => {
    $(`#${id}`).addEventListener("input", renderFinance);
  });

  $("#salesForm").addEventListener("input", updateSalePreview);

  // VACIAR PRODUCTOS SIN MOVIMIENTOS ASOCIADOS

  $("#clearInventory").addEventListener("click", () => {
    if (!db.inventory.length) return;

    if (!confirm(
      "¿Vaciar inventario? Solo se pueden quitar productos que no tengan movimientos asociados."
    )) {
      return;
    }

    db.inventory = db.inventory.filter(product =>
      db.sales.some(s =>
        norm(s.company) === norm(product.company) &&
        norm(s.productName) === norm(product.productName)
      ) ||
      db.stock.some(s =>
        norm(s.company) === norm(product.company) &&
        norm(s.productName) === norm(product.productName)
      )
    );

    save();
    renderAll();
    toast("Se eliminaron los productos sin movimientos asociados.");
  });

  // CANCELAR EDICIONES

  const cancelMap = [
    [
      "cancelInventoryEdit",
      "inventoryForm",
      "inventoryFormTitle",
      "Agregar producto o ingrediente"
    ],
    ["cancelStockEdit", "stockForm", null, null],
    [
      "cancelSaleEdit",
      "salesForm",
      "salesFormTitle",
      "Registrar una venta"
    ],
    [
      "cancelFinanceEdit",
      "financeForm",
      "financeFormTitle",
      "Registrar ingreso o egreso"
    ]
  ];

  cancelMap.forEach(([button, formId, titleId, title]) => {
    $(`#${button}`).addEventListener("click", () => {
      const form = $(`#${formId}`);
      resetForm(form);

      $(`#${button}`).hidden = true;

      if (titleId) {
        $(`#${titleId}`).textContent = title;
      }

      if (formId === "salesForm" || formId === "financeForm") {
        form.elements.date.value = today();
      }
    });
  });

  // BOTONES DE TABLAS

  document.addEventListener("click", event => {
    const button = event.target.closest("[data-action]");
    if (!button) return;

    const { action, id } = button.dataset;

    if (action.startsWith("edit-")) {
      editRecord(action.slice(5), id);
    }

    else if (action.startsWith("delete-")) {
      deleteRecord(action.slice(7), id);
    }

    else if (action === "open-file") {
      openFile(id);
    }

    else if (action === "download-file") {
      openFile(id, true);
    }

    else if (action === "delete-file") {
      if (confirm("¿Eliminar este documento guardado?")) {
        db.files = db.files.filter(file => file.id !== id);
        save();
        renderFiles();
        toast("Documento eliminado.");
      }
    }
  });

  // REPORTES Y RESPALDOS

  $("#runReport").addEventListener("click", renderReport);

  ["reportCompany", "reportFrom", "reportTo"].forEach(id => {
    $(`#${id}`).addEventListener("input", renderReport);
  });

  $("#exportReport").addEventListener("click", exportCSV);
  $("#exportBackup").addEventListener("click", exportBackup);
  $("#importBackup").addEventListener("change", importBackup);

  // BOTONES DEL MANUAL

  $("#openManual").addEventListener("click", openManual);
  $("#heroManual").addEventListener("click", openManual);
  $("#manualClose").addEventListener("click", closeManual);
  $("#manualCloseBottom").addEventListener("click", closeManual);

  $("#printManual").addEventListener("click", () => window.print());

  $("#manualOverlay").addEventListener("click", event => {
    if (event.target.id === "manualOverlay") {
      closeManual();
    }
  });

  document.addEventListener("keydown", event => {
    if (event.key === "Escape" && !$("#manualOverlay").hidden) {
      closeManual();
    }
  });

  // MENÚ PARA TELÉFONOS Y TABLETAS

  $("#menuToggle").addEventListener("click", () => {
    const nav = $("#mainNav");
    const opened = nav.classList.toggle("open");

    $("#menuToggle").setAttribute("aria-expanded", String(opened));
  });

  $("#mainNav").addEventListener("click", event => {
    if (event.target.matches("a")) {
      $("#mainNav").classList.remove("open");
      $("#menuToggle").setAttribute("aria-expanded", "false");
    }
  });

  // FORMULARIO DE CONTACTO

  $("#contactForm").addEventListener("submit", event => {
    event.preventDefault();

    const data = formObject(event.currentTarget);
    const subject = encodeURIComponent(
      "Consulta sobre BrandSpark: Hot & Sweet"
    );

    const body = encodeURIComponent(
      `Nombre: ${data.name}\n` +
      `Correo: ${data.email}\n\n` +
      `Mensaje:\n${data.message}`
    );

    $("#contactFeedback").textContent =
      "Se abrirá tu aplicación de correo para que puedas revisar y enviar el mensaje.";

    window.location.href =
      `mailto:brandsparksv@gmail.com?subject=${subject}&body=${body}`;
  });

  // INICIAR LA PÁGINA

  $("#year").textContent = new Date().getFullYear();

  setDefaultDates();
  renderAll();
})();
