import type React from "react"
import Plot from "react-plotly.js"

interface Event {
  name: string
  date: string
  value: number
}

interface MultiEventChartProps {
  events: Event[]
  title?: string
  xAxisTitle?: string
  yAxisTitle?: string
}

const MultiEventChart: React.FC<MultiEventChartProps> = ({
  events,
  title = "Event Chart",
  xAxisTitle = "Date",
  yAxisTitle = "Value",
}) => {
  // Group events by name
  const groupedEvents = events.reduce((acc: { [key: string]: Event[] }, event) => {
    if (!acc[event.name]) {
      acc[event.name] = []
    }
    acc[event.name].push(event)
    return acc
  }, {})

  // Create traces for each event group
  const traces = Object.entries(groupedEvents).map(([name, eventList]) => ({
    x: eventList.map((event) => event.date),
    y: eventList.map((event) => event.value),
    type: "scatter",
    mode: "lines+markers",
    name: name,
    hovertemplate: `<b>${name}</b><br>Date: %{x}<br>Value: %{y}<extra></extra>`,
  }))

  const layout = {
    title: title,
    xaxis: {
      title: xAxisTitle,
      type: "date",
    },
    yaxis: {
      title: yAxisTitle,
    },
    hovermode: "closest",
  }

  const config = {
    responsive: true,
  }

  return <Plot data={traces} layout={layout} config={config} />
}

export default MultiEventChart
