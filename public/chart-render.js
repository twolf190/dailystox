// Canvas line-chart renderer shared by the homepage mini modal and the
// full chart page. Draws close-price points with a hover crosshair + tooltip.

function createChartRenderer(canvas, tooltipEl, options = {}) {
  const ctx = canvas.getContext("2d");
  let points = [];
  let layout = null;

  function setPoints(newPoints) {
    points = newPoints || [];
    hideTooltip();
    draw(null);
  }

  function draw(hoverIndex) {
    const ratio = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = Math.max(320, Math.floor(rect.width * ratio));
    canvas.height = Math.max(160, Math.floor(rect.height * ratio));
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);

    const width = canvas.width / ratio;
    const height = canvas.height / ratio;
    const pad = { top: 22, right: 56, bottom: 34, left: 16 };
    layout = null;
    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = "#171c21";
    ctx.fillRect(0, 0, width, height);

    if (points.length < 2) {
      ctx.fillStyle = "#9aa8b4";
      ctx.fillText("No chart data available.", 20, 34);
      return;
    }

    const closes = points.map((point) => point.close);
    const min = Math.min(...closes);
    const max = Math.max(...closes);
    const span = max - min || 1;
    const plotW = width - pad.left - pad.right;
    const plotH = height - pad.top - pad.bottom;
    const first = closes[0];
    const last = closes[closes.length - 1];
    const stroke = last >= first ? "#33c47f" : "#ff5f6d";
    layout = { width, height, pad, plotW, plotH, min, max, span };

    ctx.strokeStyle = "#303840";
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let i = 0; i < 5; i += 1) {
      const y = pad.top + (plotH / 4) * i;
      ctx.moveTo(pad.left, y);
      ctx.lineTo(width - pad.right, y);
    }
    ctx.stroke();

    ctx.strokeStyle = stroke;
    ctx.lineWidth = 2;
    ctx.beginPath();
    points.forEach((point, index) => {
      const x = pad.left + (plotW * index) / (points.length - 1);
      const y = pad.top + plotH - ((point.close - min) / span) * plotH;
      if (index === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();

    const gradient = ctx.createLinearGradient(0, pad.top, 0, height - pad.bottom);
    gradient.addColorStop(0, stroke + "44");
    gradient.addColorStop(1, stroke + "00");
    ctx.lineTo(width - pad.right, height - pad.bottom);
    ctx.lineTo(pad.left, height - pad.bottom);
    ctx.closePath();
    ctx.fillStyle = gradient;
    ctx.fill();

    ctx.fillStyle = "#9aa8b4";
    ctx.font = "12px system-ui";
    ctx.textAlign = "right";
    for (let i = 0; i < 5; i += 1) {
      const value = max - (span / 4) * i;
      const y = pad.top + (plotH / 4) * i + 4;
      ctx.fillText(money(value), width - 8, y);
    }

    ctx.textAlign = "left";
    ctx.fillText(new Date(points[0].time).toLocaleDateString(), pad.left, height - 10);
    ctx.textAlign = "right";
    ctx.fillText(new Date(points[points.length - 1].time).toLocaleDateString(), width - pad.right, height - 10);

    if (Number.isInteger(hoverIndex) && points[hoverIndex]) {
      drawHoverPoint(hoverIndex, stroke);
    }
  }

  function drawHoverPoint(index, stroke) {
    if (!layout) return;
    const point = points[index];
    const x = layout.pad.left + (layout.plotW * index) / (points.length - 1);
    const y = layout.pad.top + layout.plotH - ((point.close - layout.min) / layout.span) * layout.plotH;

    ctx.strokeStyle = "#f4f7f9";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x, layout.pad.top);
    ctx.lineTo(x, layout.height - layout.pad.bottom);
    ctx.stroke();

    ctx.fillStyle = stroke;
    ctx.strokeStyle = "#f4f7f9";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(x, y, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }

  function handleHover(event) {
    if (!points.length || !layout) return;

    const rect = canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const minX = layout.pad.left;
    const maxX = layout.width - layout.pad.right;
    if (x < minX || x > maxX) {
      clearHover();
      return;
    }

    const index = Math.max(0, Math.min(points.length - 1, Math.round(((x - minX) / layout.plotW) * (points.length - 1))));
    draw(index);
    showTooltip(points[index], index, rect);
  }

  function clearHover() {
    hideTooltip();
    draw(null);
  }

  function showTooltip(point, index, rect) {
    if (!layout || !tooltipEl) return;

    const x = layout.pad.left + (layout.plotW * index) / (points.length - 1);
    const y = layout.pad.top + layout.plotH - ((point.close - layout.min) / layout.span) * layout.plotH;
    const date = new Date(point.time);
    const intraday = options.isIntraday ? options.isIntraday() : false;
    const dateLabel = intraday ? date.toLocaleString() : date.toLocaleDateString();

    tooltipEl.innerHTML = `
      <strong>${money(point.close)}</strong>
      <span>${dateLabel}</span>
      <span>Volume ${compact(point.volume)}</span>
    `;
    tooltipEl.hidden = false;

    const tooltipWidth = tooltipEl.offsetWidth;
    const tooltipHeight = tooltipEl.offsetHeight;
    const left = Math.max(8, Math.min(rect.width - tooltipWidth - 8, x + 14));
    const top = Math.max(8, Math.min(rect.height - tooltipHeight - 8, y - tooltipHeight - 10));
    tooltipEl.style.left = `${left}px`;
    tooltipEl.style.top = `${top}px`;
  }

  function hideTooltip() {
    if (tooltipEl) tooltipEl.hidden = true;
  }

  canvas.addEventListener("mousemove", handleHover);
  canvas.addEventListener("mouseleave", clearHover);

  return {
    setPoints,
    redraw: () => draw(null),
    destroy() {
      canvas.removeEventListener("mousemove", handleHover);
      canvas.removeEventListener("mouseleave", clearHover);
    }
  };
}
