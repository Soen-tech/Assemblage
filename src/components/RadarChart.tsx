import { 
  Radar, RadarChart, PolarGrid, 
  PolarAngleAxis, ResponsiveContainer 
} from 'recharts';

interface SWRIChartProps {
  profile?: {
    peaty: number;
    fruity: number;
    floral: number;
    cereal: number;
    intensity: number;
    category?: 'whisky' | 'wine';
  };
}

export default function SWRIChart({ profile }: SWRIChartProps) {
  if (!profile) return null;

  const isWine = profile.category === 'wine';

  const chartData = [
    { subject: isWine ? 'SWEETNESS' : 'PEATY', value: profile.peaty, fullMark: 10 },
    { subject: isWine ? 'FRUITINESS' : 'FRUITY', value: profile.fruity, fullMark: 10 },
    { subject: isWine ? 'ACIDITY' : 'FLORAL', value: profile.floral, fullMark: 10 },
    { subject: isWine ? 'TANNINS' : 'CEREAL', value: profile.cereal, fullMark: 10 },
    { subject: isWine ? 'BODY' : 'INTENSITY', value: profile.intensity, fullMark: 10 },
  ];

  return (
    <div className="w-full h-64 flex items-center justify-center">
      <ResponsiveContainer width="100%" height="100%">
        <RadarChart cx="50%" cy="50%" outerRadius="80%" data={chartData}>
          <PolarGrid stroke="#353534" strokeDasharray="3 3" />
          <PolarAngleAxis 
            dataKey="subject" 
            tick={{ fill: '#dac2b2', fontSize: 10, fontWeight: 600 }} 
          />
          <Radar
            name="Profile"
            dataKey="value"
            stroke="#ffb77d"
            fill="#ffb77d"
            fillOpacity={0.4}
          />
        </RadarChart>
      </ResponsiveContainer>
    </div>
  );
}
