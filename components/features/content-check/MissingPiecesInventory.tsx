'use client';

import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ChevronRight, ChevronDown } from 'lucide-react';
import { useToast } from '@/lib/context/toast-context';

interface MissingPiece {
  piece_description: string;
  game_id: string;
  game_name: string;
  check_id: string;
  reported_by: string;
  reported_date: string;
  notes: string | null;
}

export default function MissingPiecesInventory() {
  const { addToast } = useToast();
  const [pieces, setPieces] = useState<MissingPiece[]>([]);
  const [filteredPieces, setFilteredPieces] = useState<MissingPiece[]>([]);
  const [expandedPiece, setExpandedPiece] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [markingFound, setMarkingFound] = useState<string | null>(null);

  useEffect(() => {
    fetchMissingPieces();
  }, []);

  useEffect(() => {
    // Filter pieces based on search term
    if (searchTerm) {
      const filtered = pieces.filter((piece) =>
        piece.piece_description.toLowerCase().includes(searchTerm.toLowerCase())
      );
      setFilteredPieces(filtered);
    } else {
      setFilteredPieces(pieces);
    }
  }, [searchTerm, pieces]);

  const fetchMissingPieces = async () => {
    try {
      const response = await fetch('/api/content-checks/missing-pieces');
      if (response.ok) {
        const data = await response.json();
        setPieces(data.pieces);
        setFilteredPieces(data.pieces);
      }
    } catch (error) {
      console.error('Error fetching missing pieces:', error);
    } finally {
      setLoading(false);
    }
  };

  const toggleExpand = (pieceDescription: string) => {
    setExpandedPiece(
      expandedPiece === pieceDescription ? null : pieceDescription
    );
  };

  const handleMarkFound = async (piece: MissingPiece) => {
    try {
      setMarkingFound(piece.check_id);

      // 1. Fetch the full details of the previous content check
      const checkResponse = await fetch(`/api/content-checks/${piece.check_id}`);
      if (!checkResponse.ok) {
        throw new Error('Failed to fetch previous check details');
      }
      const checkData = await checkResponse.json();
      const previousCheck = checkData.check;

      if (!previousCheck) {
        throw new Error('Previous check not found');
      }

      // 2. Get current staff member as inspector
      const staffRecordId = localStorage.getItem('staff_record_id');
      if (!staffRecordId) {
        addToast('Please log in as staff to mark pieces as found', 'error');
        return;
      }

      // 3. Create new content check with previous details + "- Found!" appended
      const newMissingPieces = previousCheck.missing_pieces
        ? `${previousCheck.missing_pieces} - Found!`
        : '- Found!';

      const createResponse = await fetch('/api/games/content-check', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          gameId: piece.game_id,
          inspector: staffRecordId,
          status: previousCheck.status,
          boxCondition: previousCheck.box_condition,
          cardCondition: previousCheck.card_condition,
          missingPieces: newMissingPieces,
          notes: previousCheck.notes || '',
          sleevedAtCheck: previousCheck.sleeved_at_check || false,
          boxWrappedAtCheck: previousCheck.box_wrapped_at_check || false,
        }),
      });

      if (!createResponse.ok) {
        throw new Error('Failed to create new content check');
      }

      // 4. Refresh the missing pieces list
      await fetchMissingPieces();

      // 5. Show success message
      addToast(`Marked piece as found for ${piece.game_name}`, 'success');

    } catch (error) {
      console.error('Error marking piece as found:', error);
      addToast('Failed to mark piece as found. Please try again.', 'error');
    } finally {
      setMarkingFound(null);
    }
  };

  if (loading) {
    return (
      <Card className="p-6">
        <h2 className="text-lg font-semibold mb-4">Missing Pieces Inventory</h2>
        <div className="animate-pulse space-y-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-10 bg-gray-200 rounded"></div>
          ))}
        </div>
      </Card>
    );
  }

  return (
    <Card className="p-6">
      <div className="mb-4">
        <h2 className="text-lg font-semibold">Missing Pieces Inventory</h2>
        <p className="text-sm text-gray-600">
          {filteredPieces.length} missing pieces across{' '}
          {new Set(filteredPieces.map((p) => p.game_id)).size} games
        </p>
      </div>

      <Input
        placeholder="Search pieces..."
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
        className="mb-4"
      />

      <div className="space-y-2 max-h-[500px] overflow-y-auto">
        {filteredPieces.length === 0 ? (
          <p className="text-center text-gray-500 py-8">
            {searchTerm ? 'No pieces match your search' : 'All pieces accounted for!'}
          </p>
        ) : (
          filteredPieces.map((piece, index) => (
            <div key={`${piece.check_id}-${index}`} className="border rounded-lg">
              <button
                onClick={() => toggleExpand(piece.piece_description + index)}
                className="w-full flex items-center justify-between p-3 hover:bg-gray-50 text-left"
              >
                <span className="font-medium">{piece.piece_description}</span>
                {expandedPiece === piece.piece_description + index ? (
                  <ChevronDown className="h-5 w-5 text-gray-400" />
                ) : (
                  <ChevronRight className="h-5 w-5 text-gray-400" />
                )}
              </button>

              {expandedPiece === piece.piece_description + index && (
                <div className="p-3 border-t bg-gray-50 space-y-2">
                  <div>
                    <span className="text-sm font-medium">Game: </span>
                    <span className="text-sm">{piece.game_name}</span>
                  </div>
                  <div>
                    <span className="text-sm font-medium">Reported: </span>
                    <span className="text-sm">
                      {new Date(piece.reported_date).toLocaleDateString()} by{' '}
                      {piece.reported_by}
                    </span>
                  </div>
                  {piece.notes && (
                    <div>
                      <span className="text-sm font-medium">Note: </span>
                      <span className="text-sm">{piece.notes}</span>
                    </div>
                  )}
                  <div className="flex gap-2 mt-2">
                    <Button
                      size="sm"
                      variant="default"
                      onClick={() => handleMarkFound(piece)}
                      disabled={markingFound === piece.check_id}
                    >
                      {markingFound === piece.check_id ? 'Marking...' : 'Mark Found'}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => window.location.href = `/games?staff=true&openGame=${piece.game_id}`}
                    >
                      View Game
                    </Button>
                  </div>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </Card>
  );
}
