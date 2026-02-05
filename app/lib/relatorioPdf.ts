'use client';

import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import {
  AjusteBanco,
  Config,
  Ponto,
  formatarMinutos,
  metaMinutosDoDia,
  workedMinutesFromPunches,
} from './pontoStore';
import { dateKeyLocal, toDateKey } from './dates';

// Configurações Globais de Estilo
const MOSTRAR_GRAFICO = true; // Mude para false se achar que 30 dias ficou poluido
const DIAS_FILTRO = 30; // Quantidade de dias para filtrar

type ColorTuple = [number, number, number];

const COLORS: { [key: string]: ColorTuple } = {
  textPrimary: [30, 41, 59],    // Slate 800 (Escuro, quase preto)
  textSecondary: [100, 116, 139], // Slate 500 (Cinza médio)
  positive: [22, 163, 74],      // Green 600
  negative: [220, 38, 38],      // Red 600
  headerBg: [241, 245, 249],    // Slate 100
  tableHeader: [51, 65, 85],    // Slate 700
  accent: [37, 99, 235],        // Blue 600 (Barra lateral)
  gridLine: [226, 232, 240]     // Slate 200
};

type ChartItem = { label: string; saldo: number };

function drawSaldoChart(doc: jsPDF, items: ChartItem[], startY: number): number {
  if (items.length === 0) return startY;

  const pageWidth = doc.internal.pageSize.getWidth();
  const marginX = 14;
  const chartW = pageWidth - (marginX * 2);
  const chartH = 45; // Altura um pouco menor para ficar elegante
  const chartY = startY + 12;
  
  // Título do Gráfico com fonte melhorada
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(...COLORS.textPrimary);
  doc.text(`Variação de Saldo (Últimos ${items.length} dias)`, marginX, startY + 6);
  doc.setFont('helvetica', 'normal'); // Reset

  const maxAbs = Math.max(1, ...items.map(i => Math.abs(i.saldo))); 
  const zeroY = chartY + (chartH / 2); 
  const scale = (chartH / 2 - 5) / maxAbs; 

  // Fundo sutil
  doc.setDrawColor(...COLORS.gridLine); 
  doc.setFillColor(255, 255, 255);
  doc.rect(marginX, chartY, chartW, chartH, 'F'); 
  
  // Linha zero
  doc.setLineWidth(0.5);
  doc.setDrawColor(203, 213, 225); 
  doc.line(marginX, zeroY, marginX + chartW, zeroY);

  const step = chartW / items.length;
  // Ajusta largura da barra dinamicamente
  const barW = Math.max(1.5, step * 0.65); 

  doc.setFontSize(7);

  items.forEach((item, idx) => {
    const x = marginX + (idx * step) + (step - barW) / 2;
    const barHeight = Math.abs(item.saldo) * scale;
    
    // Cor da barra
    if (item.saldo >= 0) {
      doc.setFillColor(...COLORS.positive); 
      doc.rect(x, zeroY - barHeight, barW, barHeight, 'F');
    } else {
      doc.setFillColor(...COLORS.negative); 
      doc.rect(x, zeroY, barW, barHeight, 'F');
    }

    // LABEL INTELIGENTE:
    const showLabel = items.length > 15 ? idx % 5 === 0 : true;

    if (showLabel) {
      doc.setTextColor(...COLORS.textSecondary);
      doc.text(item.label, x + (barW/2), chartY + chartH + 5, { align: 'center' });
    }
  });

  return chartY + chartH + 15; // Margem inferior
}

export function gerarRelatorioPDF(
  pontos: Ponto[],
  ajustes: AjusteBanco[],
  saldoTotal: string,
  config?: Config,
  userName?: string
) {
  const doc = new jsPDF();
  
  // --- CABEÇALHO ---
  
  // 1. Barra Lateral (Identidade visual)
  doc.setFillColor(...COLORS.accent);
  doc.rect(0, 0, 6, 297, 'F');

  // 2. Título Principal
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(24);
  doc.setTextColor(...COLORS.textPrimary);
  doc.text('Relatório de Ponto', 16, 22);

  // 3. Subtítulo (Nome do Usuário e Data)
  let headerY = 29; // Posição inicial abaixo do título

  if (userName) {
    // --- ALTERAÇÃO AQUI: Nome em destaque ---
    doc.setFont('helvetica', 'bold'); // Negrito
    doc.setFontSize(14); // Fonte maior (14px)
    doc.setTextColor(...COLORS.textPrimary); // Cor escura (igual ao título)
    doc.text(userName, 16, headerY); // Apenas o nome, sem "Usuario:"
    
    headerY += 7; // Empurra a data para baixo
  }

  // Data de Geração (Agora abaixo do nome se ele existir)
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(...COLORS.textSecondary); // Cor cinza
  const dataGeracao = new Date().toLocaleString('pt-BR', { dateStyle: 'full', timeStyle: 'medium' });
  const dataFormatada = dataGeracao.charAt(0).toUpperCase() + dataGeracao.slice(1);
  
  doc.text(`Gerado em: ${dataFormatada}`, 16, headerY);

  // 4. Card de Saldo Total
  const isNegativeTotal = saldoTotal.includes('-');
  
  // Fundo do Card
  doc.setFillColor(...COLORS.headerBg);
  doc.roundedRect(140, 12, 60, 22, 3, 3, 'F');
  
  // Label do Card
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...COLORS.textSecondary);
  doc.text('Saldo Total Atual', 148, 19);
  
  // Valor do Saldo
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  if (isNegativeTotal) {
    doc.setTextColor(...COLORS.negative);
  } else {
    doc.setTextColor(...COLORS.positive);
  }
  doc.text(saldoTotal, 148, 28);
  doc.setFont('helvetica', 'normal'); // Reset

  // --- PROCESSAMENTO DE DADOS ---

  // 1. Agrupar
  const map = new Map<string, Ponto[]>();
  pontos.forEach((p) => {
    const k = toDateKey(p.atISO);
    map.set(k, [...(map.get(k) || []), p]);
  });

  const ajustesMap = new Map<string, AjusteBanco[]>();
  ajustes.forEach((a) => {
    const k = toDateKey(a.atISO);
    ajustesMap.set(k, [...(ajustesMap.get(k) || []), a]);
  });

  const atestadoKeys = new Set(
    ajustes.filter((a) => a.tipo === 'ATESTADO').map((a) => toDateKey(a.atISO))
  );

  // 2. Filtrar ultimos 30 dias
  const allKeys = new Set<string>([...Array.from(map.keys()), ...Array.from(atestadoKeys)]);
  const diasTodasKeys = Array.from(allKeys).sort().reverse();
  const diasFiltrados = diasTodasKeys.slice(0, DIAS_FILTRO);

  // 3. Mapear para objeto de resumo
  const diasResumo = diasFiltrados.map((dia) => {
    const pts = (map.get(dia) || []).sort((a, b) => +new Date(a.atISO) - +new Date(b.atISO));
    const trabalhado = workedMinutesFromPunches(pts);
    const hasAtestado = (ajustesMap.get(dia) ?? []).some((a) => a.tipo === 'ATESTADO');
    const metaBase = metaMinutosDoDia(dia, config);
    const meta = hasAtestado && pts.length === 0 ? 0 : metaBase;
    const saldoDia = trabalhado - meta;

    const batidasStr = pts
      .map((p) => {
        const time = new Date(p.atISO).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
        return time; 
      })
      .join(' • ');

    const batidas = hasAtestado
      ? (batidasStr ? `${batidasStr} • Atestado` : 'Atestado')
      : (batidasStr || '-');

    return {
      iso: dia,
      batidas,
      meta,
      trabalhado,
      saldo: saldoDia,
    };
  });

  // --- GRÁFICO ---
  // Ajustamos o início do conteúdo baseado se tem nome ou não
  let currentY = userName ? 52 : 45;

  if (MOSTRAR_GRAFICO && diasResumo.length > 0) {
    const chartData = [...diasResumo].reverse().map((d) => ({
      label: new Date(d.iso + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }),
      saldo: d.saldo,
    }));
    
    currentY = drawSaldoChart(doc, chartData, currentY);
  } else {
    currentY += 10;
  }

  // --- TABELA ---
  const tableData = diasResumo.map((d) => [
    new Date(d.iso + 'T12:00:00').toLocaleDateString('pt-BR'),
    d.batidas,
    formatarMinutos(d.meta),
    formatarMinutos(d.trabalhado),
    formatarMinutos(d.saldo),
  ]);

  autoTable(doc, {
    startY: currentY,
    head: [['Data', 'Batidas', 'Meta', 'Trab', 'Saldo']],
    body: tableData,
    theme: 'grid',
    styles: { 
      fontSize: 9, 
      cellPadding: 4, 
      textColor: COLORS.textPrimary,
      font: 'helvetica'
    },
    headStyles: { 
      fillColor: COLORS.tableHeader, 
      textColor: [255, 255, 255], 
      fontStyle: 'bold',
      halign: 'center'
    },
    columnStyles: {
      0: { cellWidth: 25, halign: 'center' }, // Data
      1: { cellWidth: 'auto' }, // Batidas
      2: { cellWidth: 20, halign: 'center' }, // Meta
      3: { cellWidth: 20, halign: 'center' }, // Trab
      4: { cellWidth: 25, halign: 'right', fontStyle: 'bold' }, // Saldo
    },
    alternateRowStyles: { 
      fillColor: COLORS.headerBg 
    },
    didParseCell: function(data: any) {
        if (data.section === 'body' && data.column.index === 4) {
            const text = data.cell.raw as string;
            if (text.includes('-')) {
                data.cell.styles.textColor = COLORS.negative;
            } else {
                data.cell.styles.textColor = COLORS.positive;
            }
        }
    }
  });

  doc.save(`Relatorio_Ponto_${dateKeyLocal()}.pdf`);
}
