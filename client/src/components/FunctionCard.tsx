import { Link } from 'react-router-dom';

interface FunctionCardProps {
  id: string;
  name: string;
  description?: string;
}

export function FunctionCard({ id, name, description }: FunctionCardProps) {
  return (
    <Link
      to={`/function/${id}`}
      className="function-card"
    >
      <div className="card-header">
        <h3>{name}</h3>
      </div>
      {description && <p className="card-description">{description}</p>}
      <div className="card-actions">
        <button className="btn-primary">使用此功能</button>
      </div>
    </Link>
  );
}
