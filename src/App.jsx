import React, { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import { createClient } from "@supabase/supabase-js";
import {
  Plus,
  Pencil,
  Trash2,
  CheckCircle2,
  Image as ImageIcon,
  LogIn,
  LogOut,
  X,
} from "lucide-react";
import "./styles.css";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

const supabase =
  supabaseUrl && supabaseAnonKey
    ? createClient(supabaseUrl, supabaseAnonKey)
    : null;

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function monthKeyFromDate(dateString) {
  return dateString.slice(0, 7);
}

function currentMonthKey() {
  return monthKeyFromDate(todayISO());
}

function formatWon(value) {
  return Number(value || 0).toLocaleString("ko-KR") + "원";
}

function formatShortDate(dateString) {
  const date = new Date(dateString + "T00:00:00");
  return `${date.getMonth() + 1}/${date.getDate()}`;
}

function formatMonthLabel(monthKey) {
  const [year, month] = monthKey.split("-");
  return `${year}년 ${Number(month)}월`;
}

function sortItems(items) {
  return [...items].sort((a, b) => {
    if (a.paid_date !== b.paid_date) return a.paid_date.localeCompare(b.paid_date);
    return a.created_at.localeCompare(b.created_at);
  });
}

function roundRect(ctx, x, y, w, h, r) {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
}

function buildSettlementImage(items, monthKey, total) {
  const sortedItems = sortItems(items);
  const scale = 2;
  const width = 430;
  const padding = 24;
  const headerHeight = 150;
  const rowHeight = 38;
  const footerHeight = 66;
  const height = headerHeight + sortedItems.length * rowHeight + footerHeight;

  const canvas = document.createElement("canvas");
  canvas.width = width * scale;
  canvas.height = height * scale;

  const ctx = canvas.getContext("2d");
  ctx.scale(scale, scale);

  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, width, height);

  ctx.fillStyle = "#111827";
  ctx.font = "700 26px -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
  ctx.fillText("엄마 받을 돈", padding, 44);

  ctx.fillStyle = "#6b7280";
  ctx.font = "500 15px -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
  ctx.fillText(formatMonthLabel(monthKey), padding, 72);

  ctx.fillStyle = "#7d9d6a";
  ctx.beginPath();
  roundRect(ctx, padding, 92, width - padding * 2, 54, 16);
  ctx.fill();

  ctx.fillStyle = "#ffffff";
  ctx.font = "700 17px -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
  ctx.fillText("합계", padding + 18, 126);
  ctx.textAlign = "right";
  ctx.fillText(formatWon(total), width - padding - 18, 126);
  ctx.textAlign = "left";

  let y = 184;

  sortedItems.forEach((item) => {
    ctx.fillStyle = "#f9fafb";
    ctx.beginPath();
    roundRect(ctx, padding, y - 24, width - padding * 2, 32, 10);
    ctx.fill();

    ctx.fillStyle = "#6b7280";
    ctx.font = "500 13px -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
    ctx.fillText(formatShortDate(item.paid_date), padding + 12, y - 2);

    ctx.fillStyle = "#111827";
    ctx.font = "600 14px -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
    const title = item.title.length > 16 ? item.title.slice(0, 15) + "…" : item.title;
    ctx.fillText(title, padding + 58, y - 2);

    ctx.textAlign = "right";
    ctx.fillStyle = "#111827";
    ctx.font = "700 14px -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
    ctx.fillText(formatWon(item.amount), width - padding - 12, y - 2);
    ctx.textAlign = "left";

    y += rowHeight;
  });

  ctx.strokeStyle = "#e5e7eb";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(padding, height - 50);
  ctx.lineTo(width - padding, height - 50);
  ctx.stroke();

  ctx.fillStyle = "#9ca3af";
  ctx.font = "500 12px -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
  ctx.fillText("pay-me-mom", padding, height - 23);

  return canvas.toDataURL("image/png");
}

function App() {
  const [session, setSession] = useState(null);
  const [items, setItems] = useState([]);
  const [selectedMonth, setSelectedMonth] = useState(currentMonthKey());
  const [showHistory, setShowHistory] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [editingItem, setEditingItem] = useState(null);
  const [form, setForm] = useState({
    paid_date: todayISO(),
    title: "",
    amount: "",
  });
  const [imageUrl, setImageUrl] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!supabase) {
      setIsLoading(false);
      return;
    }

    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setIsLoading(false);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
    });

    return () => listener.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (session) {
      fetchItems();
    } else {
      setItems([]);
    }
  }, [session]);

  const visibleItems = useMemo(() => {
    return sortItems(items.filter((item) => item.month_key === selectedMonth));
  }, [items, selectedMonth]);

  const currentMonthItems = useMemo(() => {
    return items.filter((item) => item.month_key === currentMonthKey());
  }, [items]);

  const currentMonthTotal = useMemo(() => {
    return currentMonthItems.reduce((sum, item) => sum + Number(item.amount || 0), 0);
  }, [currentMonthItems]);

  const visibleTotal = useMemo(() => {
    return visibleItems.reduce((sum, item) => sum + Number(item.amount || 0), 0);
  }, [visibleItems]);

  const months = useMemo(() => {
    const set = new Set(items.map((item) => item.month_key));
    set.add(currentMonthKey());
    return [...set].sort((a, b) => b.localeCompare(a));
  }, [items]);

  const monthIsSettled = visibleItems.length > 0 && visibleItems.every((item) => item.is_settled);

  async function fetchItems() {
    setIsLoading(true);
    const { data, error } = await supabase
      .from("pay_me_mom_items")
      .select("*")
      .order("paid_date", { ascending: true })
      .order("created_at", { ascending: true });

    if (error) {
      setMessage("내역을 불러오지 못했어요.");
    } else {
      setItems(data || []);
    }

    setIsLoading(false);
  }

  async function login() {
    if (!supabase) return;
  
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: window.location.href.split("?")[0].split("#")[0],
      },
    });
}

  async function logout() {
    await supabase.auth.signOut();
  }

  function resetForm() {
    setEditingItem(null);
    setForm({
      paid_date: todayISO(),
      title: "",
      amount: "",
    });
  }

  function startEdit(item) {
    setEditingItem(item);
    setForm({
      paid_date: item.paid_date,
      title: item.title,
      amount: String(item.amount),
    });
    setImageUrl("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function saveItem(event) {
    event.preventDefault();

    const title = form.title.trim();
    const amount = Number(String(form.amount).replaceAll(",", ""));

    if (!title || !form.paid_date || !amount || amount < 0) {
      setMessage("날짜, 내용, 금액을 입력해 주세요.");
      return;
    }

    const payload = {
      paid_date: form.paid_date,
      title,
      amount,
      month_key: monthKeyFromDate(form.paid_date),
    };

    let error;

    if (editingItem) {
      const result = await supabase
        .from("pay_me_mom_items")
        .update(payload)
        .eq("id", editingItem.id);
      error = result.error;
    } else {
      const result = await supabase.from("pay_me_mom_items").insert(payload);
      error = result.error;
    }

    if (error) {
      setMessage("저장하지 못했어요.");
      return;
    }

    setMessage(editingItem ? "수정했어요." : "추가했어요.");
    setSelectedMonth(payload.month_key);
    resetForm();
    await fetchItems();
  }

  async function deleteItem(item) {
    const ok = window.confirm(`"${item.title}" 내역을 삭제할까요?`);
    if (!ok) return;

    const { error } = await supabase.from("pay_me_mom_items").delete().eq("id", item.id);

    if (error) {
      setMessage("삭제하지 못했어요.");
      return;
    }

    setMessage("삭제했어요.");
    await fetchItems();
  }

  async function settleMonth() {
    if (visibleItems.length === 0) {
      setMessage("정산할 내역이 없어요.");
      return;
    }

    const ok = window.confirm(`${formatMonthLabel(selectedMonth)} 내역을 정산 완료로 표시할까요?`);
    if (!ok) return;

    const { error } = await supabase
      .from("pay_me_mom_items")
      .update({
        is_settled: true,
        settled_at: new Date().toISOString(),
      })
      .eq("month_key", selectedMonth);

    if (error) {
      setMessage("정산 완료 처리에 실패했어요.");
      return;
    }

    setMessage("정산 완료로 표시했어요.");
    await fetchItems();
  }

  async function reopenMonth() {
    const ok = window.confirm(`${formatMonthLabel(selectedMonth)} 정산 완료를 해제할까요?`);
    if (!ok) return;

    const { error } = await supabase
      .from("pay_me_mom_items")
      .update({
        is_settled: false,
        settled_at: null,
      })
      .eq("month_key", selectedMonth);

    if (error) {
      setMessage("정산 완료 해제에 실패했어요.");
      return;
    }

    setMessage("정산 완료를 해제했어요.");
    await fetchItems();
  }

  function createImage() {
    if (visibleItems.length === 0) {
      setMessage("이미지로 만들 내역이 없어요.");
      return;
    }

    const url = buildSettlementImage(visibleItems, selectedMonth, visibleTotal);
    setImageUrl(url);
    setMessage("정산 이미지를 만들었어요.");
  }

  async function shareImage() {
    if (!imageUrl) return;

    const blob = await (await fetch(imageUrl)).blob();
    const file = new File([blob], `엄마-받을-돈-${selectedMonth}.png`, { type: "image/png" });

    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      await navigator.share({
        files: [file],
        title: "엄마 받을 돈",
      });
    } else {
      setMessage("이미지를 길게 눌러 저장하거나 공유해 주세요.");
    }
  }

  if (!supabase) {
    return (
      <main className="app-shell">
        <section className="empty-card">
          <h1>엄마 받을 돈</h1>
          <p>.env에 Supabase URL과 anon key를 넣어 주세요.</p>
        </section>
      </main>
    );
  }

  return (
    <main className="app-shell">
      <header className="app-header">
        <div>
          <p className="eyebrow">pay-me-mom</p>
          <h1>엄마 받을 돈</h1>
        </div>
      </header>

      {session ? (
        <>
          <section className="summary-card">
            <div>
              <p className="label">이번 달 합계</p>
              <strong>{formatWon(currentMonthTotal)}</strong>
            </div>
            <span className="month-pill">{formatMonthLabel(currentMonthKey())}</span>
          </section>

          <section className="card">
            <div className="section-title">
              <h2>{editingItem ? "내역 수정" : "내역 추가"}</h2>
              {editingItem && (
                <button type="button" className="ghost-button small" onClick={resetForm}>
                  <X size={16} />
                  취소
                </button>
              )}
            </div>

            <form className="item-form" onSubmit={saveItem}>
              <label>
                날짜
                <input
                  type="date"
                  value={form.paid_date}
                  onChange={(event) => setForm({ ...form, paid_date: event.target.value })}
                />
              </label>

              <label>
                내용
                <input
                  type="text"
                  value={form.title}
                  onChange={(event) => setForm({ ...form, title: event.target.value })}
                />
              </label>

              <label>
                금액
                <input
                  type="number"
                  inputMode="numeric"
                  value={form.amount}
                  onChange={(event) => setForm({ ...form, amount: event.target.value })}
                />
              </label>

              <button type="submit" className="primary-button">
                <Plus size={18} />
                {editingItem ? "수정하기" : "추가하기"}
              </button>
            </form>
          </section>

          <section className="card">
            <div className="month-toolbar">
              <button
                type="button"
                className={selectedMonth === currentMonthKey() ? "tab active" : "tab"}
                onClick={() => setSelectedMonth(currentMonthKey())}
              >
                이번 달
              </button>

              <button
                type="button"
                className={showHistory ? "tab active" : "tab"}
                onClick={() => setShowHistory(!showHistory)}
              >
                지난 내역 보기
              </button>
            </div>

            {showHistory && (
              <div className="month-list">
                {months.map((month) => (
                  <button
                    key={month}
                    type="button"
                    className={selectedMonth === month ? "month-button active" : "month-button"}
                    onClick={() => setSelectedMonth(month)}
                  >
                    {formatMonthLabel(month)}
                  </button>
                ))}
              </div>
            )}

            <div className="list-header">
              <div>
                <h2>{formatMonthLabel(selectedMonth)}</h2>
                <p>{visibleItems.length}건 · {formatWon(visibleTotal)}</p>
              </div>

              {monthIsSettled && <span className="settled-badge">정산 완료</span>}
            </div>

            {isLoading ? (
              <p className="muted">불러오는 중...</p>
            ) : visibleItems.length === 0 ? (
              <div className="empty-state">아직 내역이 없어요.</div>
            ) : (
              <ul className="item-list">
                {visibleItems.map((item) => (
                  <li key={item.id} className={item.is_settled ? "item settled" : "item"}>
                    <div className="item-main">
                      <span className="item-date">{formatShortDate(item.paid_date)}</span>
                      <span className="item-title">{item.title}</span>
                      <strong>{formatWon(item.amount)}</strong>
                    </div>

                    <div className="item-actions">
                      <button type="button" onClick={() => startEdit(item)} aria-label="수정">
                        <Pencil size={16} />
                      </button>
                      <button type="button" onClick={() => deleteItem(item)} aria-label="삭제">
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}

            <div className="action-grid">
              {monthIsSettled ? (
                <button type="button" className="secondary-button" onClick={reopenMonth}>
                  정산 완료 해제
                </button>
              ) : (
                <button type="button" className="secondary-button" onClick={settleMonth}>
                  <CheckCircle2 size={18} />
                  정산 완료
                </button>
              )}

              <button type="button" className="secondary-button" onClick={createImage}>
                <ImageIcon size={18} />
                정산 이미지 만들기
              </button>
            </div>
          </section>

          {imageUrl && (
            <section className="card image-card">
              <div className="section-title">
                <h2>정산 이미지</h2>
                <button type="button" className="ghost-button small" onClick={() => setImageUrl("")}>
                  닫기
                </button>
              </div>

              <img src={imageUrl} alt="정산 이미지" className="settlement-image" />

              <button type="button" className="primary-button" onClick={shareImage}>
                공유하기
              </button>
              <p className="hint">공유가 안 되면 이미지를 길게 눌러 저장하면 돼요.</p>
            </section>
          )}

          {message && <p className="toast">{message}</p>}

          <footer className="login-footer">
            <p>{session.user.email}</p>
            <button type="button" className="ghost-button" onClick={logout}>
              <LogOut size={17} />
              로그아웃
            </button>
          </footer>
        </>
      ) : (
        <section className="empty-card">
          <h2>로그인하면 바로 기록할 수 있어요.</h2>
          <p>이번 달 받을 돈만 가볍게 쌓아두는 장부입니다.</p>

          <div className="bottom-login">
            <button type="button" className="primary-button" onClick={login}>
              <LogIn size={18} />
              Google로 로그인
            </button>
          </div>
        </section>
      )}
    </main>
  );
}

createRoot(document.getElementById("root")).render(<App />);
