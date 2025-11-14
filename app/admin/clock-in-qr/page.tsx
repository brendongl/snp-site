'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { QrCode, Download, Printer, Loader2, Plus } from 'lucide-react';
import { useState, useEffect, useRef } from 'react';

interface QRCodeData {
  qr_data: string;
  token: string;
  location_name: string;
  location_id: string;
  generated_at: string;
}

interface Location {
  id: string;
  name: string;
}

export default function ClockInQRPage() {
  const [locations, setLocations] = useState<Location[]>([]);
  const [qrCodes, setQrCodes] = useState<QRCodeData[]>([]);
  const [loading, setLoading] = useState(false);
  const [newLocationName, setNewLocationName] = useState('');
  const [newLocationId, setNewLocationId] = useState('');

  // Fetch locations on mount
  useEffect(() => {
    fetchLocations();
  }, []);

  const fetchLocations = async () => {
    try {
      const response = await fetch('/api/clock-in/qr-generate');
      if (!response.ok) throw new Error('Failed to fetch locations');
      const data = await response.json();
      setLocations(data.locations || []);
    } catch (err) {
      console.error('Error fetching locations:', err);
    }
  };

  const generateQRCode = async (location: Location) => {
    setLoading(true);
    try {
      const response = await fetch('/api/clock-in/qr-generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          location_id: location.id,
          location_name: location.name,
        }),
      });

      if (!response.ok) throw new Error('Failed to generate QR code');
      const data = await response.json();

      // Add to QR codes list
      setQrCodes((prev) => [...prev, data]);
    } catch (err) {
      console.error('Error generating QR code:', err);
      alert('Failed to generate QR code. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const downloadQRCode = (qrCode: QRCodeData) => {
    const canvas = document.getElementById(`qr-${qrCode.location_id}`) as HTMLCanvasElement;
    if (!canvas) return;

    const url = canvas.toDataURL('image/png');
    const link = document.createElement('a');
    link.download = `clock-in-qr-${qrCode.location_id}.png`;
    link.href = url;
    link.click();
  };

  const printQRCode = (qrCode: QRCodeData) => {
    const canvas = document.getElementById(`qr-${qrCode.location_id}`) as HTMLCanvasElement;
    if (!canvas) return;

    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    printWindow.document.write(`
      <html>
        <head>
          <title>Clock-in QR Code - ${qrCode.location_name}</title>
          <style>
            body {
              display: flex;
              flex-direction: column;
              align-items: center;
              justify-content: center;
              min-height: 100vh;
              font-family: Arial, sans-serif;
            }
            h1 { font-size: 32px; margin-bottom: 10px; }
            h2 { font-size: 24px; margin-bottom: 20px; color: #666; }
            img { border: 2px solid #000; padding: 20px; }
            .instructions { margin-top: 20px; text-align: center; max-width: 600px; }
            @media print {
              .no-print { display: none; }
            }
          </style>
        </head>
        <body>
          <h1>Clock In / Clock Out</h1>
          <h2>${qrCode.location_name}</h2>
          <img src="${canvas.toDataURL('image/png')}" alt="QR Code" />
          <div class="instructions">
            <p><strong>Instructions:</strong></p>
            <ol style="text-align: left;">
              <li>Open your phone camera or QR code scanner</li>
              <li>Scan this QR code</li>
              <li>Tap the notification to open the clock-in page</li>
              <li>Log in with your staff account</li>
              <li>Click "Clock In" or "Clock Out"</li>
            </ol>
          </div>
        </body>
      </html>
    `);
    printWindow.document.close();
    setTimeout(() => {
      printWindow.print();
    }, 250);
  };

  // Generate QR code using canvas
  useEffect(() => {
    const loadQRCode = async () => {
      // Dynamically import qrcode
      const QRCodeLib = (await import('qrcode')).default;

      qrCodes.forEach((qr) => {
        const canvas = document.getElementById(`qr-${qr.location_id}`) as HTMLCanvasElement;
        if (canvas) {
          QRCodeLib.toCanvas(canvas, qr.qr_data, {
            width: 300,
            margin: 2,
            color: {
              dark: '#000000',
              light: '#FFFFFF'
            }
          });
        }
      });
    };

    if (qrCodes.length > 0) {
      loadQRCode();
    }
  }, [qrCodes]);

  return (
    <div className="container mx-auto p-4 sm:p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <QrCode className="h-8 w-8" />
          Clock-in QR Codes
        </h1>
        <p className="text-muted-foreground">
          Generate QR codes for staff to clock in/out at different locations
        </p>
      </div>

      {/* Pre-configured Locations */}
      <Card>
        <CardHeader>
          <CardTitle>Available Locations</CardTitle>
          <CardDescription>
            Generate QR codes for these pre-configured locations
          </CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {locations.map((location) => (
            <Button
              key={location.id}
              variant="outline"
              className="h-auto py-4"
              onClick={() => generateQRCode(location)}
              disabled={loading}
            >
              <div className="flex flex-col items-center gap-2">
                <QrCode className="h-8 w-8" />
                <span className="font-medium">{location.name}</span>
              </div>
            </Button>
          ))}
        </CardContent>
      </Card>

      {/* Generated QR Codes */}
      {qrCodes.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {qrCodes.map((qrCode) => (
            <Card key={qrCode.location_id}>
              <CardHeader>
                <CardTitle>{qrCode.location_name}</CardTitle>
                <CardDescription>
                  Generated {new Date(qrCode.generated_at).toLocaleString()}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* QR Code Canvas */}
                <div className="flex justify-center p-4 bg-white rounded">
                  <canvas id={`qr-${qrCode.location_id}`} />
                </div>

                {/* Token Display */}
                <div className="text-xs text-muted-foreground break-all">
                  <strong>Token:</strong> {qrCode.token.substring(0, 40)}...
                </div>

                {/* Actions */}
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1"
                    onClick={() => downloadQRCode(qrCode)}
                  >
                    <Download className="mr-2 h-4 w-4" />
                    Download
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1"
                    onClick={() => printQRCode(qrCode)}
                  >
                    <Printer className="mr-2 h-4 w-4" />
                    Print
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Instructions */}
      <Card>
        <CardHeader>
          <CardTitle>How to Use</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <ol className="list-decimal list-inside space-y-2">
            <li>Click a location button above to generate a QR code</li>
            <li>Download or print the QR code</li>
            <li>Display the QR code at the physical location</li>
            <li>Staff can scan the QR code with their phone to clock in/out</li>
            <li>Staff must be logged in to use the clock-in feature</li>
          </ol>
        </CardContent>
      </Card>
    </div>
  );
}
