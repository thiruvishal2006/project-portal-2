(function () {
  "use strict";

  var TOKEN_KEY = "prp_token";
  var USERNAME_KEY = "prp_username";

  function getToken() { return localStorage.getItem(TOKEN_KEY); }
  function setSession(token, username) {
    localStorage.setItem(TOKEN_KEY, token);
    localStorage.setItem(USERNAME_KEY, username);
  }
  function clearSession() {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USERNAME_KEY);
  }

  function api(path, opts) {
    opts = opts || {};
    var headers = Object.assign({ "Content-Type": "application/json" }, opts.headers || {});
    var token = getToken();
    if (token) headers["Authorization"] = "Bearer " + token;
    return fetch(path, {
      method: opts.method || "GET",
      headers: headers,
      body: opts.body ? JSON.stringify(opts.body) : undefined,
    });
  }

  var authScreen = document.getElementById("authScreen");
  var formScreen = document.getElementById("formScreen");
  var userBar = document.getElementById("userBar");
  var userLabel = document.getElementById("userLabel");

  var tabLogin = document.getElementById("tabLogin");
  var tabRegister = document.getElementById("tabRegister");
  var loginForm = document.getElementById("loginForm");
  var registerForm = document.getElementById("registerForm");
  var loginErr = document.getElementById("loginErr");
  var regErr = document.getElementById("regErr");

  tabLogin.addEventListener("click", function () {
    tabLogin.classList.add("active"); tabRegister.classList.remove("active");
    loginForm.classList.remove("hidden"); registerForm.classList.add("hidden");
  });
  tabRegister.addEventListener("click", function () {
    tabRegister.classList.add("active"); tabLogin.classList.remove("active");
    registerForm.classList.remove("hidden"); loginForm.classList.add("hidden");
  });

  registerForm.addEventListener("submit", function (e) {
    e.preventDefault();
    regErr.textContent = "";
    var body = {
      name: document.getElementById("regName").value.trim(),
      username: document.getElementById("regUser").value.trim(),
      password: document.getElementById("regPass").value,
    };
    api("/api/register", { method: "POST", body: body })
      .then(function (r) { return r.json().then(function (d) { return { ok: r.ok, d: d }; }); })
      .then(function (res) {
        if (!res.ok) { regErr.textContent = res.d.error || "Registration failed."; return; }
        setSession(res.d.token, res.d.username);
        enterApp(res.d.username);
      })
      .catch(function () { regErr.textContent = "Could not reach the server. Is it running?"; });
  });

  loginForm.addEventListener("submit", function (e) {
    e.preventDefault();
    loginErr.textContent = "";
    var body = {
      username: document.getElementById("loginUser").value.trim(),
      password: document.getElementById("loginPass").value,
    };
    api("/api/login", { method: "POST", body: body })
      .then(function (r) { return r.json().then(function (d) { return { ok: r.ok, d: d }; }); })
      .then(function (res) {
        if (!res.ok) { loginErr.textContent = res.d.error || "Login failed."; return; }
        setSession(res.d.token, res.d.username);
        enterApp(res.d.username);
      })
      .catch(function () { loginErr.textContent = "Could not reach the server. Is it running?"; });
  });

  document.getElementById("logoutBtn").addEventListener("click", function () {
    api("/api/logout", { method: "POST" }).finally(function () {
      clearSession();
      location.reload();
    });
  });

  function enterApp(username) {
    authScreen.classList.add("hidden");
    formScreen.classList.remove("hidden");
    userBar.classList.remove("hidden");
    userLabel.textContent = username;
    loadProject();
  }

  // ---- Dynamic modules ----
  var modCountInput = document.getElementById("pModCount");
  var moduleList = document.getElementById("moduleList");

  function renderModules(count, existing) {
    moduleList.innerHTML = "";
    count = Math.max(0, Math.min(15, count || 0));
    for (var i = 1; i <= count; i++) {
      var item = document.createElement("div");
      item.className = "module-item";
      var prev = (existing && existing[i - 1]) || {};
      item.innerHTML =
        '<div class="mnum">Module ' + i + '</div>' +
        '<div class="field" style="margin-bottom:8px;"><label>Module name</label>' +
        '<input class="modName" data-i="' + i + '" value="' + escapeAttr(prev.name || "") + '" required></div>' +
        '<div class="field" style="margin-bottom:0;"><label>Module details</label>' +
        '<textarea class="modDetail" data-i="' + i + '" required>' + escapeHtml(prev.detail || "") + '</textarea></div>';
      moduleList.appendChild(item);
    }
  }
  function escapeAttr(s) { return String(s).replace(/"/g, "&quot;"); }
  function escapeHtml(s) { return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"); }

  modCountInput.addEventListener("input", function () {
    renderModules(parseInt(modCountInput.value, 10) || 0);
  });

  function collectModules() {
    var names = document.querySelectorAll(".modName");
    var mods = [];
    names.forEach(function (input) {
      var i = input.getAttribute("data-i");
      var detail = document.querySelector('.modDetail[data-i="' + i + '"]');
      mods.push({ name: input.value.trim(), detail: detail ? detail.value.trim() : "" });
    });
    return mods;
  }

  function readForm() {
    return {
      title: document.getElementById("pTitle").value.trim(),
      abstract: document.getElementById("pAbstract").value.trim(),
      description: document.getElementById("pDesc").value.trim(),
      literature: document.getElementById("pLit").value.trim(),
      modCount: parseInt(modCountInput.value, 10) || 0,
      other: document.getElementById("pOther").value.trim(),
      modules: collectModules(),
    };
  }

  function fillForm(data) {
    document.getElementById("pTitle").value = data.title || "";
    document.getElementById("pAbstract").value = data.abstract || "";
    document.getElementById("pDesc").value = data.description || "";
    document.getElementById("pLit").value = data.literature || "";
    document.getElementById("pOther").value = data.other || "";
    modCountInput.value = data.modCount || "";
    renderModules(data.modCount || 0, data.modules || []);
  }

  function loadProject() {
    api("/api/project").then(function (r) { return r.json(); }).then(function (data) {
      if (data) fillForm(data);
    }).catch(function () {});
  }

  function saveProject() {
    return api("/api/project", { method: "POST", body: readForm() })
      .then(function (r) { return r.json().then(function (d) { return { ok: r.ok, d: d }; }); });
  }

  document.getElementById("saveDraftBtn").addEventListener("click", function () {
    var st = document.getElementById("formStatus");
    var formErr = document.getElementById("formErr");
    formErr.textContent = "";
    saveProject().then(function (res) {
      if (!res.ok) { formErr.textContent = res.d.error || "Could not save."; return; }
      st.textContent = "Draft saved.";
      setTimeout(function () { st.textContent = ""; }, 2000);
    });
  });

  document.getElementById("projectForm").addEventListener("submit", function (e) {
    e.preventDefault();
    var formErr = document.getElementById("formErr");
    var st = document.getElementById("formStatus");
    formErr.textContent = "";
    st.textContent = "";

    saveProject().then(function (res) {
      if (!res.ok) { formErr.textContent = res.d.error || "Could not save."; return; }
      st.textContent = "Generating your PDF...";
      return api("/api/project/report", { method: "POST" }).then(function (r) {
        if (!r.ok) {
          return r.json().then(function (d) { throw new Error(d.error || "Could not generate report."); });
        }
        return r.blob();
      }).then(function (blob) {
        var url = URL.createObjectURL(blob);
        var a = document.createElement("a");
        a.href = url;
        a.download = (document.getElementById("pTitle").value.trim() || "project_report")
          .replace(/[^a-z0-9]+/gi, "_").toLowerCase() + ".pdf";
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(function () { URL.revokeObjectURL(url); }, 4000);
        st.textContent = "Report downloaded.";
      }).catch(function (err) {
        st.textContent = "";
        formErr.textContent = err.message;
      });
    });
  });

  // ---- Boot ----
  if (getToken()) {
    enterApp(localStorage.getItem(USERNAME_KEY));
  }
})();
