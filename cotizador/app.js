/* =========================================================================
   app.js — Solicitud de cotización (Pilotaje / Excavación)
   Maneja: validación, armado del mensaje, envío por WhatsApp y correo,
   copiar texto, imprimir y limpieza automática post-envío.
   ========================================================================= */

   (function () {
    "use strict";
  
    /* ---------------------------------------------------------------------
       1. CONFIGURACIÓN — EDITA AQUÍ TUS DATOS DE CONTACTO
       --------------------------------------------------------------------- */
    const CONFIG = {
      EMAILS: ["neosconstrucciones@gmail.com", "malovico63@gmail.com"],
  
      WHATSAPP_NUMBERS: [
        { label: "Asesor 1", number: "573114903895" },
        { label: "Asesor 2", number: "573174395112" },
      ],
  
      NOMBRE_EMPRESA: "Neosconstruccions S.A.S",
  
      USE_EMAILJS: false,
      EMAILJS_PUBLIC_KEY: "TU_PUBLIC_KEY",
      EMAILJS_SERVICE_ID: "TU_SERVICE_ID",
      EMAILJS_TEMPLATE_ID: "TU_TEMPLATE_ID",
    };
  
    /* ---------------------------------------------------------------------
       2. Etiquetas legibles para cada campo del formulario
       --------------------------------------------------------------------- */
    const LABELS = {
      empresa: "Compañía",
      direccion: "Dirección",
      telefono: "Teléfono",
      obra: "Obra",
      ubicacion: "Ubicación",
      diametro: "Diámetro del pilote (cm)",
      profundidad_pilote: "Profundidad del pilote (m)",
      cantidad: "Cantidad de pilotes",
      estudio_suelos: "Estudio de suelos",
      m3_excavacion: "Vol. excavación (m³)",
      m3_descapote: "Vol. descapote (m³)",
      profundidad_excavacion: "Profundidad de excavación (m)",
      tipo_maquinaria: "Tipo de maquinaria",
      horas_alquiler: "Horas de alquiler (h/día)",
      tiempo_alquiler: "Tiempo de alquiler",
      tiempo_unidad: "Unidad de tiempo",
      notas: "Notas adicionales",
    };
  
    const CAMPOS_CLIENTE = ["empresa", "direccion", "telefono", "obra", "ubicacion"];
    const CAMPOS_PILOTAJE = ["diametro", "profundidad_pilote", "cantidad", "estudio_suelos"];
    const CAMPOS_EXCAVACION = [
      "m3_excavacion",
      "m3_descapote",
      "profundidad_excavacion",
      "tipo_maquinaria",
      "horas_alquiler",
      "tiempo_alquiler",
      "tiempo_unidad",
    ];
  
    /* ---------------------------------------------------------------------
       3. Estado y referencias del DOM
       --------------------------------------------------------------------- */
    let lastMessage = "";
    let lastRef = "";
  
    document.addEventListener("DOMContentLoaded", () => {
      const form = document.getElementById("quote-form");
      if (!form) return;
  
      const sendPanel = document.getElementById("send-panel");
      const specStatus = document.querySelector("[data-spec-status]");
      const specRef = document.querySelector("[data-spec-ref]");
  
      const btnWa1 = document.getElementById("send-wa-1");
      const btnWa2 = document.getElementById("send-wa-2");
      const btnMail = document.getElementById("send-mail");
      const btnCopy = document.getElementById("send-copy");
      const btnPrint = document.getElementById("send-print");
      const btnNew = document.getElementById("send-new");
      const copyToast = document.getElementById("copy-toast");
  
      if (btnWa1) btnWa1.textContent = `WhatsApp · ${CONFIG.WHATSAPP_NUMBERS[0].label}`;
      if (btnWa2) btnWa2.textContent = `WhatsApp · ${CONFIG.WHATSAPP_NUMBERS[1].label}`;
  
      /* --- Función central de limpieza para formularios y ficha --- */
      function reiniciarSolicitudCompleta() {
        form.reset();
        if (sendPanel) sendPanel.classList.add("is-hidden");
        if (specStatus) {
          specStatus.textContent = "Borrador";
          specStatus.classList.remove("ready");
        }
        if (specRef) specRef.textContent = "REF —";
        
        // Fuerza al DOM a actualizar el resumen dinámico de la derecha
        form.dispatchEvent(new Event("change", { bubbles: true }));
        window.scrollTo({ top: form.offsetTop - 100, behavior: "smooth" });
      }
  
      /* --- Envío del formulario --- */
      form.addEventListener("submit", (e) => {
        e.preventDefault();
  
        if (!validarFormulario(form)) return;
  
        const tipo = getTipoActivo();
        const datos = recolectarDatos(form, tipo);
        lastRef = generarReferencia();
        lastMessage = construirMensaje(datos, tipo, lastRef);
  
        // Actualiza la ficha lateral
        if (specStatus) {
          specStatus.textContent = "Listo para enviar";
          specStatus.classList.add("ready");
        }
        if (specRef) specRef.textContent = lastRef;
  
        // Prepara los enlaces de envío
        prepararEnlaceWhatsApp(btnWa1, CONFIG.WHATSAPP_NUMBERS[0].number, lastMessage);
        prepararEnlaceWhatsApp(btnWa2, CONFIG.WHATSAPP_NUMBERS[1].number, lastMessage);
        prepararEnlaceCorreo(btnMail, lastMessage, tipo, lastRef);
  
        // Muestra el panel de envío
        if (sendPanel) {
          sendPanel.classList.remove("is-hidden");
          sendPanel.scrollIntoView({ behavior: "smooth", block: "start" });
        }
      });
  
      /* --- Acciones de envío con limpieza automática integrada --- */
      if (btnWa1) {
        btnWa1.addEventListener("click", () => {
          setTimeout(reiniciarSolicitudCompleta, 300);
        });
      }
  
      if (btnWa2) {
        btnWa2.addEventListener("click", () => {
          setTimeout(reiniciarSolicitudCompleta, 300);
        });
      }
  
      if (btnMail) {
        btnMail.addEventListener("click", (e) => {
          if (!CONFIG.USE_EMAILJS) {
            setTimeout(reiniciarSolicitudCompleta, 300);
            return; // Permite abrir el mailto normalmente
          }
          e.preventDefault();
          enviarConEmailJS(lastMessage, getTipoActivo(), lastRef, btnMail, reiniciarSolicitudCompleta);
        });
      }
  
      /* --- Copiar texto --- */
      if (btnCopy) {
        btnCopy.addEventListener("click", async () => {
          try {
            await navigator.clipboard.writeText(lastMessage || "");
            mostrarToast(copyToast);
          } catch (err) {
            alert("No se pudo copiar automáticamente. Copia el texto manualmente.");
          }
        });
      }
  
      /* --- Imprimir / PDF --- */
      if (btnPrint) {
        btnPrint.addEventListener("click", () => window.print());
      }
  
      /* --- Botón manual de nueva solicitud --- */
      if (btnNew) {
        btnNew.addEventListener("click", reiniciarSolicitudCompleta);
      }
    });
  
    /* ---------------------------------------------------------------------
       4. Funciones auxiliares
       --------------------------------------------------------------------- */
  
    function getTipoActivo() {
      const activo = document.querySelector(".seg-btn.is-active");
      return activo ? activo.getAttribute("data-type") : "pilotes";
    }
  
    function validarFormulario(form) {
      let valido = true;
      const requeridos = form.querySelectorAll("[required]");
  
      requeridos.forEach((campo) => {
        const errEl = campo.closest(".field")?.querySelector("[data-err]");
        const vacio = !campo.value || !campo.value.trim();
  
        if (vacio) {
          valido = false;
          campo.setAttribute("aria-invalid", "true");
          if (errEl) {
            errEl.textContent = "Este campo es obligatorio.";
            errEl.classList.add("show");
          }
        } else {
          campo.removeAttribute("aria-invalid");
          if (errEl) errEl.classList.remove("show");
        }
      });
  
      if (!valido) {
        const primerError = form.querySelector('[aria-invalid="true"]');
        if (primerError) {
          primerError.scrollIntoView({ behavior: "smooth", block: "center" });
          primerError.focus();
        }
      }
  
      return valido;
    }
  
    function recolectarDatos(form, tipo) {
      const fd = new FormData(form);
      const campos = CAMPOS_CLIENTE.concat(
        tipo === "pilotes" ? CAMPOS_PILOTAJE : CAMPOS_EXCAVACION
      );
      const datos = [];
  
      campos.forEach((key) => {
        const valor = (fd.get(key) || "").toString().trim();
        if (valor) datos.push([LABELS[key] || key, valor]);
      });
  
      const notas = (fd.get("notas") || "").toString().trim();
      if (notas) datos.push([LABELS.notas, notas]);
  
      return datos;
    }
  
    function generarReferencia() {
      const d = new Date();
      const pad = (n) => String(n).padStart(2, "0");
      return `REF-${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(
        d.getHours()
      )}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
    }
  
    function construirMensaje(datos, tipo, ref) {
      const tituloTipo = tipo === "pilotes" ? "PILOTAJE" : "EXCAVACIÓN";
      const lineas = [];
  
      lineas.push(`SOLICITUD DE COTIZACIÓN — ${tituloTipo}`);
      lineas.push(`Empresa: ${CONFIG.NOMBRE_EMPRESA}`);
      lineas.push(`Referencia: ${ref}`);
      lineas.push("");
  
      datos.forEach(([label, valor]) => {
        lineas.push(`${label}: ${valor}`);
      });
  
      return lineas.join("\n");
    }
  
    function prepararEnlaceWhatsApp(anchor, numero, mensaje) {
      if (!anchor) return;
      const url = `https://wa.me/${numero}?text=${encodeURIComponent(mensaje)}`;
      anchor.setAttribute("href", url);
    }
  
    function prepararEnlaceCorreo(anchor, mensaje, tipo, ref) {
      if (!anchor) return;
      if (CONFIG.USE_EMAILJS) {
        anchor.setAttribute("href", "javascript:void(0)");
        return;
      }
      const asunto = encodeURIComponent(
        `Solicitud de cotización — ${tipo === "pilotes" ? "Pilotaje" : "Excavación"} — ${ref}`
      );
      const cuerpo = encodeURIComponent(mensaje);
      const destinatarios = CONFIG.EMAILS.join(",");
      anchor.setAttribute("href", `mailto:${destinatarios}?subject=${asunto}&body=${cuerpo}`);
    }
  
    function mostrarToast(toastEl) {
      if (!toastEl) return;
      toastEl.classList.remove("is-hidden");
      clearTimeout(toastEl._timeout);
      toastEl._timeout = setTimeout(() => toastEl.classList.add("is-hidden"), 2200);
    }
  
    /* ---------------------------------------------------------------------
       5. Envío automático opcional vía EmailJS
       --------------------------------------------------------------------- */
    function enviarConEmailJS(mensaje, tipo, ref, btnMail, callbackExito) {
      if (typeof emailjs === "undefined") {
        alert(
          "EmailJS no está cargado. Agrega su script en el HTML antes de app.js, o desactiva USE_EMAILJS."
        );
        return;
      }
  
      emailjs.init(CONFIG.EMAILJS_PUBLIC_KEY);
  
      const textoOriginal = btnMail.textContent;
      btnMail.textContent = "Enviando…";
      btnMail.style.pointerEvents = "none";
  
      const envios = CONFIG.EMAILS.map((to_email) =>
        emailjs.send(CONFIG.EMAILJS_SERVICE_ID, CONFIG.EMAILJS_TEMPLATE_ID, {
          to_email,
          asunto: `Solicitud de cotización — ${tipo === "pilotes" ? "Pilotaje" : "Excavación"} — ${ref}`,
          mensaje,
          referencia: ref,
        })
      );
  
      Promise.all(envios)
        .then(() => {
          btnMail.textContent = "Correo enviado ✓";
          setTimeout(() => {
            btnMail.textContent = textoOriginal;
            btnMail.style.pointerEvents = "";
            if (typeof callbackExito === "function") callbackExito();
          }, 1500);
        })
        .catch((err) => {
          console.error("Error enviando con EmailJS:", err);
          btnMail.textContent = textoOriginal;
          btnMail.style.pointerEvents = "";
          alert("No se pudo enviar el correo automáticamente. Intenta de nuevo.");
        });
    }
  })();