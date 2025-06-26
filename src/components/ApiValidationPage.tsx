
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { 
  CheckCircle, 
  AlertTriangle, 
  Clock, 
  Database,
  Camera,
  MapPin,
  Search,
  Settings
} from 'lucide-react';
import PlacesApiTestPanel from './PlacesApiTestPanel';

const ApiValidationPage: React.FC = () => {
  const migrationStatus = [
    {
      endpoint: 'google-places-search',
      status: 'completed',
      description: 'Migrated to Places API v1 searchText endpoint',
      changes: [
        'POST request with JSON body',
        'locationBias for geographic searches',
        'Field masking for cost optimization',
        'New photo URL format'
      ]
    },
    {
      endpoint: 'google-places-nearby',
      status: 'completed',
      description: 'Migrated to Places API v1 searchNearby endpoint',
      changes: [
        'includedTypes array format',
        'locationRestriction with circle',
        'Enhanced field selection',
        'Improved error handling'
      ]
    },
    {
      endpoint: 'google-places-details',
      status: 'completed',
      description: 'Migrated to Places API v1 place details endpoint',
      changes: [
        'Direct place ID lookup',
        'Field masking implementation',
        'New photo media URLs',
        'Enhanced place information'
      ]
    }
  ];

  const validationChecklist = [
    {
      category: 'API Endpoints',
      icon: <Database className="w-4 h-4" />,
      items: [
        { task: 'google-places-search endpoint migration', status: 'completed' },
        { task: 'google-places-nearby endpoint migration', status: 'completed' },
        { task: 'google-places-details endpoint migration', status: 'completed' },
        { task: 'Request/response format validation', status: 'pending' },
        { task: 'Error handling verification', status: 'pending' }
      ]
    },
    {
      category: 'Photo URLs',
      icon: <Camera className="w-4 h-4" />,
      items: [
        { task: 'New photo URL format implementation', status: 'completed' },
        { task: 'Photo accessibility testing', status: 'pending' },
        { task: 'Image loading performance validation', status: 'pending' },
        { task: 'Attribution requirements check', status: 'pending' }
      ]
    },
    {
      category: 'Backward Compatibility',
      icon: <Settings className="w-4 h-4" />,
      items: [
        { task: 'Response structure mapping', status: 'completed' },
        { task: 'Frontend integration validation', status: 'pending' },
        { task: 'Existing UI component compatibility', status: 'pending' },
        { task: 'Data field consistency check', status: 'pending' }
      ]
    },
    {
      category: 'Performance & Cost',
      icon: <Clock className="w-4 h-4" />,
      items: [
        { task: 'Field masking implementation', status: 'completed' },
        { task: 'Response time benchmarking', status: 'pending' },
        { task: 'API quota usage monitoring', status: 'pending' },
        { task: 'Cost optimization validation', status: 'pending' }
      ]
    }
  ];

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return <Badge className="bg-green-100 text-green-800"><CheckCircle className="w-3 h-3 mr-1" />Completed</Badge>;
      case 'pending':
        return <Badge variant="secondary"><Clock className="w-3 h-3 mr-1" />Pending</Badge>;
      case 'warning':
        return <Badge variant="outline" className="border-yellow-500 text-yellow-700"><AlertTriangle className="w-3 h-3 mr-1" />Warning</Badge>;
      default:
        return <Badge variant="outline">Unknown</Badge>;
    }
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold mb-2">Google Places API Migration Validation</h1>
        <p className="text-gray-600">
          Comprehensive testing and validation for the Google Places API v1 migration
        </p>
      </div>

      <Tabs defaultValue="overview" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="testing">Live Testing</TabsTrigger>
          <TabsTrigger value="checklist">Validation Checklist</TabsTrigger>
          <TabsTrigger value="migration">Migration Status</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MapPin className="w-5 h-5" />
                Migration Overview
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid md:grid-cols-2 gap-6">
                <div>
                  <h3 className="font-semibold mb-3">Migration Completed</h3>
                  <ul className="space-y-2 text-sm">
                    <li className="flex items-center gap-2">
                      <CheckCircle className="w-4 h-4 text-green-600" />
                      All three endpoints migrated to Places API v1
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle className="w-4 h-4 text-green-600" />
                      New photo URL format implemented
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle className="w-4 h-4 text-green-600" />
                      Field masking for cost optimization
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle className="w-4 h-4 text-green-600" />
                      Backward compatibility maintained
                    </li>
                  </ul>
                </div>
                <div>
                  <h3 className="font-semibold mb-3">Validation Required</h3>
                  <ul className="space-y-2 text-sm">
                    <li className="flex items-center gap-2">
                      <Clock className="w-4 h-4 text-blue-600" />
                      End-to-end functionality testing
                    </li>
                    <li className="flex items-center gap-2">
                      <Clock className="w-4 h-4 text-blue-600" />
                      Photo URL accessibility verification
                    </li>
                    <li className="flex items-center gap-2">
                      <Clock className="w-4 h-4 text-blue-600" />
                      Performance benchmarking
                    </li>
                    <li className="flex items-center gap-2">
                      <Clock className="w-4 h-4 text-blue-600" />
                      Error handling validation
                    </li>
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="testing">
          <PlacesApiTestPanel />
        </TabsContent>

        <TabsContent value="checklist" className="space-y-4">
          {validationChecklist.map((category, index) => (
            <Card key={index}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  {category.icon}
                  {category.category}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {category.items.map((item, itemIndex) => (
                    <div key={itemIndex} className="flex items-center justify-between p-2 rounded border">
                      <span className="text-sm">{item.task}</span>
                      {getStatusBadge(item.status)}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </TabsContent>

        <TabsContent value="migration" className="space-y-4">
          {migrationStatus.map((endpoint, index) => (
            <Card key={index}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg">{endpoint.endpoint}</CardTitle>
                  {getStatusBadge(endpoint.status)}
                </div>
                <p className="text-sm text-gray-600">{endpoint.description}</p>
              </CardHeader>
              <CardContent>
                <h4 className="font-semibold mb-2">Key Changes:</h4>
                <ul className="space-y-1">
                  {endpoint.changes.map((change, changeIndex) => (
                    <li key={changeIndex} className="flex items-center gap-2 text-sm">
                      <CheckCircle className="w-3 h-3 text-green-600 flex-shrink-0" />
                      {change}
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          ))}
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default ApiValidationPage;
