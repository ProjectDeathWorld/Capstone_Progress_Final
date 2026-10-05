import { completedOfficeShares } from '../utils/completedOfficeShares.mjs'

export default function CompletedOfficeChart({ rows }) {
  const { total, offices } = completedOfficeShares(rows)
  return (
    <figure className="office-share-chart" aria-label="Percentage share of completed tickets by office">
      <figcaption>Completed Ticket Share by Office</figcaption>
      <div className="office-share-scale" aria-hidden="true"><span>0%</span><span>50%</span><span>100%</span></div>
      {offices.map(({ office, percentage }) => (
        <div className="office-share-row" key={office}>
          <span className="office-share-name">{office}</span>
          <div className="office-share-track" role="img" aria-label={`${office}: ${percentage.toFixed(1)}% of completed tickets`}>
            <div className="office-share-bar" style={{ width: `${percentage}%` }} />
          </div>
          <strong className="office-share-value">{percentage.toFixed(1)}%</strong>
        </div>
      ))}
      {total === 0 && <p className="office-share-empty">No completed tickets for the selected period.</p>}
    </figure>
  )
}
