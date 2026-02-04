'use client';

import {
  AjusteBanco,
  Config,
  Ponto,
  formatarMinutos,
  metaMinutosDoDia,
  workedMinutesFromPunches,
} from './pontoStore';
import { dateKeyLocal, toDateKey } from './dates';

// --- CONFIGURAÇÕES ---
const OCULTAR_DIAS_SEM_ATIVIDADE = true;
const INCLUIR_COLUNA_EXTRAS = true;

// Cores ARGB para Excel (Alpha + Hex)
const COLORS = {
  headerBg: 'FF334155', // Slate 700
  textHeader: 'FFFFFFFF', // Branco
  weekendBg: 'FFF1F5F9', // Slate 100
  zebraBg: 'FFFFFFFF', // Fundo branco
  textGreen: 'FF15803D', // Green 700
  textRed: 'FFB91C1C', // Red 700
  textDefault: 'FF334155', // Slate 700
  border: 'FFE2E8F0', // Slate 200
};

type RelatorioRow = {
  data: string;

  // NOVO: colunas de batidas
  entrada: string;
  saidaAlmoco: string;
  voltaAlmoco: string;
  saida: string;
  extras?: string;

  meta: string;
  trabalhado: string;
  saldo: string;

  saldoMinutos: number;
  metaMinutos: number;
  trabalhadoMinutos: number;
  dataObj: Date;
};

function formatarHoraPtBR(iso: string): string {
  return new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

function extrairBatidasEmColunas(pontos: Ponto[]) {
  const horarios = (pontos || [])
    .slice()
    .sort((a, b) => +new Date(a.atISO) - +new Date(b.atISO))
    .map((p) => formatarHoraPtBR(p.atISO));

  const entrada = horarios[0] ?? '-';
  const saidaAlmoco = horarios[1] ?? '-';
  const voltaAlmoco = horarios[2] ?? '-';
  const saida = horarios[3] ?? '-';
  const rest = horarios.slice(4);

  const extras = rest.length ? rest.map((h) => `• ${h}`).join('  ') : '-';

  return { entrada, saidaAlmoco, voltaAlmoco, saida, extras };
}

function buildAllRows(pontos: Ponto[], config?: Config): RelatorioRow[] {
  const map = new Map<string, Ponto[]>();
  pontos.forEach((p) => {
    const k = toDateKey(p.atISO);
    map.set(k, [...(map.get(k) || []), p]);
  });

  const diasTodasKeys = Array.from(map.keys()).sort().reverse();

  let rows = diasTodasKeys.map((dia) => {
    const pts = (map.get(dia) || []).sort((a, b) => +new Date(a.atISO) - +new Date(b.atISO));

    const trabalhadoMinutos = workedMinutesFromPunches(pts);
    const metaMinutos = metaMinutosDoDia(dia, config);
    const saldoMinutos = trabalhadoMinutos - metaMinutos;

    const colBatidas = extrairBatidasEmColunas(pts);

    const base: RelatorioRow = {
      data: new Date(dia + 'T12:00:00').toLocaleDateString('pt-BR'),

      entrada: colBatidas.entrada,
      saidaAlmoco: colBatidas.saidaAlmoco,
      voltaAlmoco: colBatidas.voltaAlmoco,
      saida: colBatidas.saida,

      meta: formatarMinutos(metaMinutos),
      trabalhado: formatarMinutos(trabalhadoMinutos),
      saldo: formatarMinutos(saldoMinutos),

      saldoMinutos,
      metaMinutos,
      trabalhadoMinutos,
      dataObj: new Date(dia + 'T12:00:00'),
    };

    if (INCLUIR_COLUNA_EXTRAS) {
      base.extras = colBatidas.extras;
    }

    return base;
  });

  if (OCULTAR_DIAS_SEM_ATIVIDADE) {
    rows = rows.filter((r) => r.metaMinutos > 0 || r.trabalhadoMinutos > 0);
  }

  return rows;
}

function downloadBlob(filename: string, mime: string, data: BlobPart) {
  const blob = new Blob([data], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// Renderiza o Gráfico para Imagem
function renderChartToBase64(rows: RelatorioRow[], title: string): string | null {
  if (typeof document === 'undefined') return null;
  if (rows.length === 0) return null;

  const chartData = [...rows].reverse();
  const width = 1200;
  const height = 400;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, width, height);

  ctx.fillStyle = '#1e293b';
  ctx.font = 'bold 24px Arial';
  ctx.fillText(title, 20, 40);

  const chartX = 50;
  const chartY = 60;
  const chartW = width - 100;
  const chartH = height - 100;

  const values = chartData.map((r) => r.saldoMinutos);
  const maxAbs = Math.max(1, ...values.map(Math.abs));

  const zeroY = chartY + chartH / 2;
  const scale = (chartH / 2 - 10) / maxAbs;

  ctx.strokeStyle = '#cbd5e1';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(chartX, zeroY);
  ctx.lineTo(chartX + chartW, zeroY);
  ctx.stroke();

  const step = chartW / chartData.length;
  const barW = Math.max(3, step * 0.6);

  ctx.font = '12px Arial';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';

  chartData.forEach((r, idx) => {
    const x = chartX + idx * step + (step - barW) / 2;
    const barHeight = Math.abs(r.saldoMinutos) * scale;
    const val = r.saldoMinutos;

    if (val >= 0) {
      ctx.fillStyle = '#16a34a';
      ctx.fillRect(x, zeroY - barHeight, barW, barHeight);
    } else {
      ctx.fillStyle = '#dc2626';
      ctx.fillRect(x, zeroY, barW, barHeight);
    }

    const density = chartData.length > 60 ? 10 : chartData.length > 20 ? 5 : 1;
    if (idx % density === 0) {
      ctx.fillStyle = '#64748b';
      const label = r.data.slice(0, 5);
      ctx.fillText(label, x + barW / 2, chartY + chartH + 5);
    }
  });

  return canvas.toDataURL('image/png');
}

/**
 * Função de Estilo Principal
 */
function estilizarTabela(sheet: any, rows: RelatorioRow[], startRow: number) {
  // Definição dinâmica das colunas
  const headersBase = ['Data', 'Entrada', 'Saída (Almoço)', 'Volta (Almoço)', 'Saída'];
  const headers = INCLUIR_COLUNA_EXTRAS
    ? [...headersBase, 'Extras', 'Meta', 'Trabalhado', 'Saldo']
    : [...headersBase, 'Meta', 'Trabalhado', 'Saldo'];

  const totalCols = headers.length;

  // Cabeçalho
  const headerRow = sheet.getRow(startRow);
  headerRow.values = headers;
  headerRow.font = { name: 'Arial', size: 11, bold: true, color: { argb: COLORS.textHeader } };
  headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.headerBg } };
  headerRow.alignment = { horizontal: 'center', vertical: 'middle' };
  headerRow.height = 30;

  // Função para pegar índice 1-based
  const col = (index0: number) => index0 + 1;

  // Linhas
  rows.forEach((r, idx) => {
    const currentRow = sheet.getRow(startRow + 1 + idx);

    const values = INCLUIR_COLUNA_EXTRAS
      ? [r.data, r.entrada, r.saidaAlmoco, r.voltaAlmoco, r.saida, r.extras ?? '-', r.meta, r.trabalhado, r.saldo]
      : [r.data, r.entrada, r.saidaAlmoco, r.voltaAlmoco, r.saida, r.meta, r.trabalhado, r.saldo];

    currentRow.values = values;
    currentRow.height = 25;
    currentRow.font = { name: 'Arial', size: 10, color: { argb: COLORS.textDefault } };

    // Alinhamentos
    currentRow.getCell(col(0)).alignment = { horizontal: 'center', vertical: 'middle' }; // Data

    // Colunas de batidas
    currentRow.getCell(col(1)).alignment = { horizontal: 'center', vertical: 'middle' }; // Entrada
    currentRow.getCell(col(2)).alignment = { horizontal: 'center', vertical: 'middle' }; // Saída almoço
    currentRow.getCell(col(3)).alignment = { horizontal: 'center', vertical: 'middle' }; // Volta almoço
    currentRow.getCell(col(4)).alignment = { horizontal: 'center', vertical: 'middle' }; // Saída

    const idxMeta = INCLUIR_COLUNA_EXTRAS ? 6 : 5; // index0
    const idxTrabalhado = INCLUIR_COLUNA_EXTRAS ? 7 : 6;
    const idxSaldo = INCLUIR_COLUNA_EXTRAS ? 8 : 7;

    if (INCLUIR_COLUNA_EXTRAS) {
      currentRow.getCell(col(5)).alignment = { horizontal: 'left', vertical: 'middle', indent: 1 }; // Extras
    }

    currentRow.getCell(col(idxMeta)).alignment = { horizontal: 'center', vertical: 'middle' };
    currentRow.getCell(col(idxTrabalhado)).alignment = { horizontal: 'center', vertical: 'middle' };

    // Saldo: cor + negrito
    const cellSaldo = currentRow.getCell(col(idxSaldo));
    cellSaldo.alignment = { horizontal: 'right', vertical: 'middle', indent: 1 };
    cellSaldo.font = { name: 'Arial', size: 10, bold: true };

    if (r.saldoMinutos > 0) {
      cellSaldo.font = { ...cellSaldo.font, color: { argb: COLORS.textGreen } };
    } else if (r.saldoMinutos < 0) {
      cellSaldo.font = { ...cellSaldo.font, color: { argb: COLORS.textRed } };
    } else {
      cellSaldo.font = { ...cellSaldo.font, color: { argb: COLORS.textDefault } };
    }

    // Fundo FDS
    const diaSemana = r.dataObj.getDay(); // 0 dom, 6 sab
    if (diaSemana === 0 || diaSemana === 6) {
      currentRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.weekendBg } };
    } else {
      currentRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.zebraBg } };
    }
  });

  // Bordas
  const lastRowIdx = startRow + rows.length;
  for (let rr = startRow; rr <= lastRowIdx; rr++) {
    for (let cc = 1; cc <= totalCols; cc++) {
      const cell = sheet.getCell(rr, cc);
      cell.border = {
        bottom: { style: 'thin', color: { argb: COLORS.border } },
        right: cc !== totalCols ? { style: 'dotted', color: { argb: COLORS.border } } : undefined,
      };
    }
  }

  // Larguras
  sheet.getColumn(1).width = 16; // Data
  sheet.getColumn(2).width = 12; // Entrada
  sheet.getColumn(3).width = 16; // Saída almoço
  sheet.getColumn(4).width = 16; // Volta almoço
  sheet.getColumn(5).width = 12; // Saída

  if (INCLUIR_COLUNA_EXTRAS) {
    sheet.getColumn(6).width = 28; // Extras
    sheet.getColumn(7).width = 14; // Meta
    sheet.getColumn(8).width = 14; // Trabalhado
    sheet.getColumn(9).width = 16; // Saldo
  } else {
    sheet.getColumn(6).width = 14; // Meta
    sheet.getColumn(7).width = 14; // Trabalhado
    sheet.getColumn(8).width = 16; // Saldo
  }
}

export async function gerarRelatorioExcel(
  pontos: Ponto[],
  _ajustes: AjusteBanco[],
  saldoTotal: string,
  config?: Config,
  userName?: string
) {
  const ExcelJSImport = await import('exceljs');
  const ExcelJS = (ExcelJSImport as any).default ?? ExcelJSImport;

  const rows = buildAllRows(pontos, config);
  const workbook = new ExcelJS.Workbook();

  const totalCols = INCLUIR_COLUNA_EXTRAS ? 9 : 8;

  // 1. ABA GERAL
  const sheetGeral = workbook.addWorksheet('Visão Geral', { views: [{ showGridLines: false }] });

  // Título
  sheetGeral.mergeCells(1, 1, 1, totalCols);
  const titleCell = sheetGeral.getCell(1, 1);
  titleCell.value = 'Relatório de Ponto';
  titleCell.font = { name: 'Arial', size: 20, bold: true, color: { argb: 'FF1E293B' } };
  titleCell.alignment = { vertical: 'middle', horizontal: 'left' };
  sheetGeral.getRow(1).height = 35;

  // Subtítulo (nome + data)
  sheetGeral.mergeCells(2, 1, 2, totalCols);
  const subTitleCell = sheetGeral.getCell(2, 1);
  const nomeExibicao = userName ? `${userName}  |  ` : '';
  const dataHoje = new Date().toLocaleDateString('pt-BR', { dateStyle: 'long' });
  subTitleCell.value = `${nomeExibicao}Gerado em: ${dataHoje}`;
  subTitleCell.font = { name: 'Arial', size: 12, color: { argb: 'FF64748B' } };
  subTitleCell.alignment = { vertical: 'top', horizontal: 'left' };
  sheetGeral.getRow(2).height = 25;

  // Card Saldo
  sheetGeral.mergeCells(4, 1, 5, 3);
  const saldoLabel = sheetGeral.getCell(4, 1);
  saldoLabel.value = 'Saldo Total Acumulado:';
  saldoLabel.alignment = { vertical: 'middle', horizontal: 'center' };
  saldoLabel.font = { name: 'Arial', size: 10, color: { argb: 'FF64748B' } };
  saldoLabel.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } };
  saldoLabel.border = {
    top: { style: 'thin', color: { argb: COLORS.border } },
    left: { style: 'thin', color: { argb: COLORS.border } },
    bottom: { style: 'thin', color: { argb: COLORS.border } },
  };

  sheetGeral.mergeCells(4, 4, 5, totalCols);
  const saldoValue = sheetGeral.getCell(4, 4);
  saldoValue.value = saldoTotal;
  saldoValue.alignment = { vertical: 'middle', horizontal: 'center' };
  const isNeg = saldoTotal.includes('-');
  saldoValue.font = { name: 'Arial', size: 22, bold: true, color: { argb: isNeg ? COLORS.textRed : COLORS.textGreen } };
  saldoValue.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } };
  saldoValue.border = {
    top: { style: 'thin', color: { argb: COLORS.border } },
    right: { style: 'thin', color: { argb: COLORS.border } },
    bottom: { style: 'thin', color: { argb: COLORS.border } },
  };

  // Gráfico
  const chartPng = renderChartToBase64(rows, 'Desempenho Geral');
  if (chartPng) {
    const imageId = workbook.addImage({ base64: chartPng, extension: 'png' });
    sheetGeral.addImage(imageId, {
      tl: { col: 0, row: 6 },
      br: { col: totalCols, row: 20 },
    });
  }

  // Tabela
  estilizarTabela(sheetGeral, rows, 22);

  // 2. ABAS MENSAIS
  const mesesMap = new Map<string, RelatorioRow[]>();
  rows.forEach((row) => {
    const key = row.dataObj.toLocaleDateString('pt-BR', { month: 'short', year: 'numeric' });
    const keyCap = key.charAt(0).toUpperCase() + key.slice(1);
    mesesMap.set(keyCap, [...(mesesMap.get(keyCap) || []), row]);
  });

  mesesMap.forEach((rowsMes, nomeMes) => {
    const safeSheetName = nomeMes.replace(/[^a-zA-Z0-9 ]/g, '').slice(0, 30);
    const sheetMes = workbook.addWorksheet(safeSheetName, { views: [{ showGridLines: false }] });

    sheetMes.mergeCells(1, 1, 1, totalCols);
    const tCell = sheetMes.getCell(1, 1);
    tCell.value = `Extrato Mensal: ${nomeMes}`;
    tCell.font = { name: 'Arial', size: 16, bold: true, color: { argb: 'FF1E293B' } };
    sheetMes.getRow(1).height = 30;

    // Subtotal do mês
    let saldoMinutosMes = 0;
    rowsMes.forEach((r) => (saldoMinutosMes += r.saldoMinutos));
    const saldoMesStr = formatarMinutos(saldoMinutosMes);
    const isNegMes = saldoMinutosMes < 0;

    sheetMes.mergeCells(2, 1, 3, 4);
    const subLabel = sheetMes.getCell(2, 1);
    subLabel.value = `Saldo do Mês: ${saldoMesStr}`;
    subLabel.font = { name: 'Arial', size: 14, bold: true, color: { argb: isNegMes ? COLORS.textRed : COLORS.textGreen } };
    subLabel.alignment = { horizontal: 'left', vertical: 'middle' };

    // Gráfico do mês
    const chartMesPng = renderChartToBase64(rowsMes, `Saldo Diário - ${nomeMes}`);
    if (chartMesPng) {
      const imgId = workbook.addImage({ base64: chartMesPng, extension: 'png' });
      sheetMes.addImage(imgId, {
        tl: { col: 0, row: 4 },
        br: { col: totalCols, row: 14 },
      });
    }

    estilizarTabela(sheetMes, rowsMes, 16);
  });

  const buffer = await workbook.xlsx.writeBuffer();
  downloadBlob(
    `Relatorio_Completo_${dateKeyLocal()}.xlsx`,
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    buffer
  );
}

// Mantido CSV (agora com colunas também)
function escapeCsv(value: string) {
  if (value.includes('"')) value = value.replace(/"/g, '""');
  if (value.includes(';') || value.includes('\n') || value.includes('\r') || value.includes('"')) return `"${value}"`;
  return value;
}

export function gerarRelatorioCSV(pontos: Ponto[], _ajustes: AjusteBanco[], saldoTotal: string, config?: Config) {
  const rows = buildAllRows(pontos, config);
  const lines: string[] = [];

  lines.push([escapeCsv('Saldo Total Atual'), escapeCsv(saldoTotal)].join(';'));

  const headersBase = ['Data', 'Entrada', 'Saída (Almoço)', 'Volta (Almoço)', 'Saída'];
  const headers = INCLUIR_COLUNA_EXTRAS
    ? [...headersBase, 'Extras', 'Meta', 'Trabalhado', 'Saldo']
    : [...headersBase, 'Meta', 'Trabalhado', 'Saldo'];

  lines.push(headers.map(escapeCsv).join(';'));

  rows.forEach((r) => {
    const values = INCLUIR_COLUNA_EXTRAS
      ? [r.data, r.entrada, r.saidaAlmoco, r.voltaAlmoco, r.saida, r.extras ?? '-', r.meta, r.trabalhado, r.saldo]
      : [r.data, r.entrada, r.saidaAlmoco, r.voltaAlmoco, r.saida, r.meta, r.trabalhado, r.saldo];

    lines.push(values.map((v) => escapeCsv(String(v))).join(';'));
  });

  const csv = '\uFEFF' + lines.join('\n');
  downloadBlob(`Relatorio_Ponto_${dateKeyLocal()}.csv`, 'text/csv;charset=utf-8;', csv);
}
