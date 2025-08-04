import { useEffect, useState } from 'react';
import { RequestAttachments } from '@/components/RequestAttachments';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useRequests } from '@/hooks/useRequests';
import { useInvoices } from '@/hooks/useInvoices';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { FileText, Clock, CheckCircle, XCircle, LogOut, Eye, ThumbsUp, ThumbsDown, Download, Paperclip, MapPin, File } from 'lucide-react';

export default function DashboardGestora() {
  const { profile, signOut } = useAuth();
  const { requests, loading, updateRequestStatus } = useRequests();
  const { getInvoicesForRequest } = useInvoices();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [selectedRequest, setSelectedRequest] = useState<any>(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [processing, setProcessing] = useState(false);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [selectedPolo, setSelectedPolo] = useState<string>('todos');

  useEffect(() => {
    if (profile && profile.role !== 'gestora') {
      navigate('/dashboard-solicitante');
    }
  }, [profile, navigate]);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <Badge variant="secondary" className="bg-pending-light text-pending"><Clock className="w-3 h-3 mr-1" />Pendente</Badge>;
      case 'approved':
        return <Badge variant="secondary" className="bg-success-light text-success"><CheckCircle className="w-3 h-3 mr-1" />Aprovado</Badge>;
      case 'rejected':
        return <Badge variant="secondary" className="bg-destructive-light text-destructive"><XCircle className="w-3 h-3 mr-1" />Recusado</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const formatCurrency = (amount: number) => {
    return amount.toLocaleString('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    });
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('pt-BR');
  };

  const handleApprove = async (requestId: string) => {
    setProcessing(true);
    try {
      await updateRequestStatus(requestId, 'approved');
      toast({
        title: 'Solicitação aprovada!',
        description: 'O solicitante foi notificado por email.',
      });
    } catch (error: any) {
      toast({
        title: 'Erro ao aprovar',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setProcessing(false);
    }
  };

  const handleReject = async (requestId: string, reason: string) => {
    if (!reason.trim()) {
      toast({
        title: 'Motivo obrigatório',
        description: 'Informe o motivo da recusa.',
        variant: 'destructive',
      });
      return;
    }

    setProcessing(true);
    try {
      await updateRequestStatus(requestId, 'rejected', reason);
      toast({
        title: 'Solicitação recusada',
        description: 'O solicitante foi notificado por email.',
      });
      setSelectedRequest(null);
      setRejectionReason('');
    } catch (error: any) {
      toast({
        title: 'Erro ao recusar',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setProcessing(false);
    }
  };

  const loadInvoices = async (requestId: string) => {
    try {
      const requestInvoices = await getInvoicesForRequest(requestId);
      setInvoices(requestInvoices);
    } catch (error) {
      console.error('Error loading invoices:', error);
      setInvoices([]);
    }
  };

  const handleViewRequest = async (request: any) => {
    setSelectedRequest(request);
    await loadInvoices(request.id);
  };

  const downloadInvoice = (invoice: any) => {
    console.log('Opening invoice:', invoice);
    // Força a abertura em nova aba
    const link = document.createElement('a');
    link.href = invoice.file_url;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Função para filtrar por polo
  const filterByPolo = (requestList: any[]) => {
    if (selectedPolo === 'todos') return requestList;
    return requestList.filter(r => r.users?.polo === selectedPolo);
  };

  // Função para agrupar por polo
  const groupByPolo = (requestList: any[]) => {
    const polos = ['3M Sumaré', 'Manaus', 'Ribeirão Preto', 'Itapetininga'];
    return polos.reduce((acc, polo) => {
      acc[polo] = requestList.filter(r => r.users?.polo === polo);
      return acc;
    }, {} as Record<string, any[]>);
  };

  const pendingRequests = requests.filter(r => r.status === 'pending');
  const processedRequests = requests.filter(r => r.status !== 'pending');
  
  const filteredPendingRequests = filterByPolo(pendingRequests);
  const filteredProcessedRequests = filterByPolo(processedRequests);
  
  const groupedPendingRequests = groupByPolo(pendingRequests);
  const groupedProcessedRequests = groupByPolo(processedRequests);

  if (!profile) {
    return <div className="min-h-screen flex items-center justify-center">Carregando...</div>;
  }

  return (
    <div className="min-h-screen bg-gradient-secondary">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-primary">Ombro Amigo - Gestão</h1>
            <p className="text-muted-foreground">Bem-vinda, {profile.name}</p>
          </div>
          <Button variant="outline" onClick={signOut}>
            <LogOut className="w-4 h-4 mr-2" />
            Sair
          </Button>
        </div>

        {/* Estatísticas Rápidas */}
        <div className="grid md:grid-cols-3 gap-6 mb-8">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center space-x-2">
                <Clock className="h-8 w-8 text-pending" />
                <div>
                  <p className="text-2xl font-bold">{pendingRequests.length}</p>
                  <p className="text-sm text-muted-foreground">Pendentes</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center space-x-2">
                <CheckCircle className="h-8 w-8 text-success" />
                <div>
                  <p className="text-2xl font-bold">{requests.filter(r => r.status === 'approved').length}</p>
                  <p className="text-sm text-muted-foreground">Aprovadas</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center space-x-2">
                <XCircle className="h-8 w-8 text-destructive" />
                <div>
                  <p className="text-2xl font-bold">{requests.filter(r => r.status === 'rejected').length}</p>
                  <p className="text-sm text-muted-foreground">Recusadas</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Tabs por Polo */}
        <Tabs value={selectedPolo} onValueChange={setSelectedPolo} className="space-y-6">
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="todos">Todos os Polos</TabsTrigger>
            <TabsTrigger value="3M Sumaré">3M Sumaré</TabsTrigger>
            <TabsTrigger value="Manaus">Manaus</TabsTrigger>
            <TabsTrigger value="Ribeirão Preto">Ribeirão Preto</TabsTrigger>
            <TabsTrigger value="Itapetininga">Itapetininga</TabsTrigger>
          </TabsList>

          <TabsContent value={selectedPolo} className="space-y-6">
            <div className="grid lg:grid-cols-2 gap-8">
              {/* Solicitações Pendentes */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-xl text-primary flex items-center gap-2">
                    <Clock className="h-5 w-5" />
                    Pendentes
                    {selectedPolo !== 'todos' && (
                      <Badge variant="outline" className="ml-2">
                        <MapPin className="h-3 w-3 mr-1" />
                        {selectedPolo}
                      </Badge>
                    )}
                  </CardTitle>
                  <CardDescription>
                    Solicitações aguardando análise e aprovação
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {loading ? (
                    <div className="text-center py-8">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
                      <p className="mt-2 text-muted-foreground">Carregando...</p>
                    </div>
                  ) : filteredPendingRequests.length === 0 ? (
                    <div className="text-center py-8">
                      <CheckCircle className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                      <p className="text-muted-foreground">
                        {selectedPolo === 'todos' ? 'Nenhuma solicitação pendente' : `Nenhuma solicitação pendente em ${selectedPolo}`}
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {filteredPendingRequests.map((request) => (
                        <div key={request.id} className="border rounded-lg p-4 space-y-3">
                          <div className="flex justify-between items-start">
                            <div>
                              <h3 className="font-semibold text-foreground capitalize">{request.type}</h3>
                              <p className="text-sm text-muted-foreground">
                                {request.users?.name} • {request.users?.polo} • {formatDate(request.created_at)}
                              </p>
                            </div>
                            {getStatusBadge(request.status)}
                          </div>
                          
                          <p className="text-sm text-foreground line-clamp-2">{request.description}</p>
                          
                          <div className="flex justify-between items-center pt-2 border-t">
                            <span className="font-semibold text-primary">{formatCurrency(request.amount)}</span>
                            <div className="flex space-x-2">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleViewRequest(request)}
                              >
                                <Eye className="w-3 h-3 mr-1" />
                                Ver
                              </Button>
                              <Button
                                size="sm"
                                onClick={() => handleApprove(request.id)}
                                disabled={processing}
                                className="bg-gradient-success"
                              >
                                <ThumbsUp className="w-3 h-3 mr-1" />
                                Aprovar
                              </Button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Histórico */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-xl text-primary flex items-center gap-2">
                    <FileText className="h-5 w-5" />
                    Histórico
                    {selectedPolo !== 'todos' && (
                      <Badge variant="outline" className="ml-2">
                        <MapPin className="h-3 w-3 mr-1" />
                        {selectedPolo}
                      </Badge>
                    )}
                  </CardTitle>
                  <CardDescription>
                    Solicitações já processadas
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {filteredProcessedRequests.length === 0 ? (
                    <div className="text-center py-8">
                      <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                      <p className="text-muted-foreground">
                        {selectedPolo === 'todos' ? 'Nenhuma solicitação processada' : `Nenhuma solicitação processada em ${selectedPolo}`}
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-4 max-h-96 overflow-y-auto">
                      {filteredProcessedRequests.map((request) => (
                        <div key={request.id} className="border rounded-lg p-4 space-y-3 cursor-pointer hover:bg-muted/50" 
                             onClick={() => handleViewRequest(request)}>
                          <div className="flex justify-between items-start">
                            <div>
                              <h3 className="font-semibold text-foreground capitalize">{request.type}</h3>
                              <p className="text-sm text-muted-foreground">
                                {request.users?.name} • {request.users?.polo} • {formatDate(request.created_at)}
                              </p>
                            </div>
                            {getStatusBadge(request.status)}
                          </div>
                          
                          <div className="flex justify-between items-center">
                            <span className="font-semibold text-primary">{formatCurrency(request.amount)}</span>
                            <span className="text-xs text-muted-foreground">#{request.id.slice(0, 8)}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>

      {/* Modal de Detalhes */}
      <Dialog open={!!selectedRequest} onOpenChange={(open) => {
        if (!open) {
          setSelectedRequest(null);
          setInvoices([]);
          setRejectionReason('');
        }
      }}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Detalhes da Solicitação</DialogTitle>
            <DialogDescription>
              Analise os dados e tome uma decisão sobre a solicitação
            </DialogDescription>
          </DialogHeader>
          
          {selectedRequest && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm font-medium">Solicitante:</p>
                  <p className="text-sm text-muted-foreground">{selectedRequest.users?.name}</p>
                </div>
                <div>
                  <p className="text-sm font-medium">Email:</p>
                  <p className="text-sm text-muted-foreground">{selectedRequest.users?.email}</p>
                </div>
                <div>
                  <p className="text-sm font-medium">Polo:</p>
                  <p className="text-sm text-muted-foreground">{selectedRequest.users?.polo || 'Não informado'}</p>
                </div>
                <div>
                  <p className="text-sm font-medium">Tipo:</p>
                  <p className="text-sm text-muted-foreground capitalize">{selectedRequest.type}</p>
                </div>
                <div>
                  <p className="text-sm font-medium">Valor:</p>
                  <p className="text-sm text-muted-foreground">{formatCurrency(selectedRequest.amount)}</p>
                </div>
                <div>
                  <p className="text-sm font-medium">Data:</p>
                  <p className="text-sm text-muted-foreground">{formatDate(selectedRequest.created_at)}</p>
                </div>
              </div>
              
              <div>
                <p className="text-sm font-medium mb-2">Descrição:</p>
                <p className="text-sm text-muted-foreground p-3 bg-muted rounded-md">
                  {selectedRequest.description}
                </p>
              </div>

              {/* Dependentes */}
              {selectedRequest.dependents && selectedRequest.dependents.length > 0 && (
                <div>
                  <p className="text-sm font-medium mb-2">Dependentes:</p>
                  <div className="space-y-2">
                    {selectedRequest.dependents.map((dependent: any, index: number) => (
                      <div key={index} className="p-2 bg-muted rounded-md">
                        <p className="text-sm font-medium">{dependent.name}</p>
                        <p className="text-xs text-muted-foreground capitalize">{dependent.relationship}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Anexos da Solicitação */}
              <RequestAttachments 
                requestId={selectedRequest.id} 
                attachments={selectedRequest.attachments} 
              />


              <div>
                <p className="text-sm font-medium mb-2">Motivo da recusa (opcional):</p>
                <Textarea
                  placeholder="Informe o motivo caso vá recusar a solicitação..."
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                />
              </div>
            </div>
          )}
          
          <DialogFooter className="space-x-2">
            <Button variant="outline" onClick={() => setSelectedRequest(null)}>
              Fechar
            </Button>
            <Button
              variant="destructive"
              onClick={() => selectedRequest && handleReject(selectedRequest.id, rejectionReason)}
              disabled={processing}
            >
              <ThumbsDown className="w-4 h-4 mr-2" />
              Recusar
            </Button>
            <Button
              onClick={() => selectedRequest && handleApprove(selectedRequest.id)}
              disabled={processing}
              className="bg-gradient-success"
            >
              <ThumbsUp className="w-4 h-4 mr-2" />
              Aprovar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}