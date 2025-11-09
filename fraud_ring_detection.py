"""
Fraud Ring Detection System using Neo4j
Detects organized fraud networks based on multiple data points
"""

import json
from typing import Dict, List, Any, Tuple
from datetime import datetime, timedelta
from collections import defaultdict, Counter
import logging

# Optional imports with fallbacks
try:
    from neo4j import GraphDatabase
    HAS_NEO4J = True
except ImportError:
    HAS_NEO4J = False
    print("Neo4j not available. Fraud ring detection will be limited.")

try:
    import networkx as nx
    HAS_NETWORKX = True
except ImportError:
    HAS_NETWORKX = False
    print("NetworkX not available. Graph analysis will be limited.")

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class FraudRingDetector:
    """Advanced fraud ring detection using Neo4j graph database"""
    
    def __init__(self, neo4j_uri: str, username: str, password: str, database: str = "neo4j"):
        """Initialize Neo4j connection"""
        if not HAS_NEO4J:
            logger.warning("Neo4j not available. Fraud ring detection will be limited.")
            self.driver = None
            self.session = None
            self.database = database
            return
            
        try:
            self.driver = GraphDatabase.driver(neo4j_uri, auth=(username, password))
            self.session = self.driver.session(database=database)
            self.database = database
        except Exception as e:
            logger.error(f"Failed to connect to Neo4j: {e}")
            self.driver = None
            self.session = None
            self.database = database
        
    def close(self):
        """Close Neo4j connection"""
        if self.driver:
            self.driver.close()
    
    def create_schema(self):
        """Create Neo4j schema for fraud detection"""
        if not self.session:
            logger.warning("Neo4j not available. Cannot create schema.")
            return
            
        schema_queries = [
            # Create constraints and indexes
            "CREATE CONSTRAINT user_id_unique IF NOT EXISTS FOR (u:User) REQUIRE u.userId IS UNIQUE",
            "CREATE CONSTRAINT policy_id_unique IF NOT EXISTS FOR (p:Policy) REQUIRE p.policyId IS UNIQUE",
            "CREATE CONSTRAINT claim_id_unique IF NOT EXISTS FOR (c:Claim) REQUIRE c.claimId IS UNIQUE",
            
            # Create indexes for performance
            "CREATE INDEX user_email_idx IF NOT EXISTS FOR (u:User) ON (u.email)",
            "CREATE INDEX user_phone_idx IF NOT EXISTS FOR (u:User) ON (u.phone)",
            "CREATE INDEX claim_amount_idx IF NOT EXISTS FOR (c:Claim) ON (c.claimAmount)",
            "CREATE INDEX claim_date_idx IF NOT EXISTS FOR (c:Claim) ON (c.incidentDate)",
            "CREATE INDEX location_idx IF NOT EXISTS FOR (l:Location) ON (l.city, l.state)",
        ]
        
        for query in schema_queries:
            try:
                self.session.run(query)
                logger.info(f"Schema created: {query[:50]}...")
            except Exception as e:
                logger.warning(f"Schema creation warning: {e}")
    
    def load_data_from_firestore(self, users_data: List[Dict], policies_data: List[Dict], claims_data: List[Dict]):
        """Load data from Firestore into Neo4j"""
        logger.info("Loading data into Neo4j...")
        logger.info(f"Users data sample: {users_data[0] if users_data else 'No users'}")
        logger.info(f"Policies data sample: {policies_data[0] if policies_data else 'No policies'}")
        logger.info(f"Claims data sample: {claims_data[0] if claims_data else 'No claims'}")
        
        # Clear existing data
        self.session.run("MATCH (n) DETACH DELETE n")
        
        # Load users
        for user in users_data:
            try:
                self._create_user_node(user)
            except Exception as e:
                logger.error(f"Error creating user node: {e}, user data: {user}")
                raise
        
        # Load policies
        for policy in policies_data:
            try:
                self._create_policy_node(policy)
            except Exception as e:
                logger.error(f"Error creating policy node: {e}, policy data: {policy}")
                raise
        
        # Load claims
        for claim in claims_data:
            try:
                self._create_claim_node(claim)
            except Exception as e:
                logger.error(f"Error creating claim node: {e}, claim data: {claim}")
                raise
        
        # Create relationships
        self._create_relationships(users_data, policies_data, claims_data)
        
        logger.info("Data loading completed")
        
        # Debug: Check what's actually in the database
        result = self.session.run("MATCH (u:User) RETURN u.userId, u.email LIMIT 5")
        users_in_db = list(result)
        logger.info(f"Users in Neo4j database: {users_in_db}")
        
        result = self.session.run("MATCH (c:Claim) RETURN c.claimId, c.userId LIMIT 5")
        claims_in_db = list(result)
        logger.info(f"Claims in Neo4j database: {claims_in_db}")
    
    def _create_user_node(self, user: Dict):
        """Create user node in Neo4j"""
        query = """
        CREATE (u:User {
            userId: $userId,
            email: $email,
            phone: $phone,
            displayName: $displayName,
            insured_sex: $insured_sex,
            insured_age: $insured_age,
            insured_occupation: $insured_occupation,
            address: $address,
            createdAt: $createdAt
        })
        """
        
        self.session.run(query, {
            'userId': user.get('uid', user.get('id', '')),
            'email': user.get('email', ''),
            'phone': user.get('phone', ''),
            'displayName': user.get('displayName', ''),
            'insured_sex': user.get('insured_sex', ''),
            'insured_age': user.get('insured_age', 0),
            'insured_occupation': user.get('insured_occupation', ''),
            'address': user.get('address', ''),
            'createdAt': datetime.now().isoformat()
        })
    
    def _create_policy_node(self, policy: Dict):
        """Create policy node in Neo4j"""
        query = """
        CREATE (p:Policy {
            policyId: $policyId,
            policyName: $policyName,
            insurance_type: $insurance_type,
            policy_term: $policy_term,
            policy_start_date: $policy_start_date,
            policy_end_date: $policy_end_date,
            policy_annual_premium: $policy_annual_premium,
            sum_insured: $sum_insured,
            policy_state: $policy_state,
            policy_city: $policy_city,
            holderName: $holderName,
            userId: $userId
        })
        """
        
        self.session.run(query, {
            'policyId': policy.get('policyId', ''),
            'policyName': policy.get('policyName', ''),
            'insurance_type': policy.get('insurance_type', ''),
            'policy_term': policy.get('policy_term', ''),
            'policy_start_date': policy.get('policy_start_date', ''),
            'policy_end_date': policy.get('policy_end_date', ''),
            'policy_annual_premium': policy.get('policy_annual_premium', 0),
            'sum_insured': policy.get('sum_insured', 0),
            'policy_state': policy.get('policy_state', ''),
            'policy_city': policy.get('policy_city', ''),
            'holderName': policy.get('holderName', ''),
            'userId': policy.get('userId', '')
        })
    
    def _create_claim_node(self, claim: Dict):
        """Create claim node in Neo4j"""
        query = """
        CREATE (c:Claim {
            claimId: $claimId,
            policyId: $policyId,
            claimType: $claimType,
            claimAmount: $claimAmount,
            status: $status,
            submittedDate: $submittedDate,
            incidentDate: $incidentDate,
            description: $description,
            insurance_type: $insurance_type,
            incident_time: $incident_time,
            accident_location: $accident_location,
            hospital_name: $hospital_name,
            auto_make: $auto_make,
            auto_model: $auto_model,
            auto_year: $auto_year,
            userId: $userId,
            fraudScore: $fraudScore,
            riskLevel: $riskLevel
        })
        """
        
        self.session.run(query, {
            'claimId': claim.get('claimId', ''),
            'policyId': claim.get('policyId', ''),
            'claimType': claim.get('claimType', ''),
            'claimAmount': claim.get('claimAmount', 0),
            'status': claim.get('status', ''),
            'submittedDate': claim.get('submittedDate', ''),
            'incidentDate': claim.get('incidentDate', ''),
            'description': claim.get('description', ''),
            'insurance_type': claim.get('insurance_type', ''),
            'incident_time': claim.get('incident_time', ''),
            'accident_location': claim.get('accident_location', ''),
            'hospital_name': claim.get('hospital_name', ''),
            'auto_make': claim.get('auto_make', ''),
            'auto_model': claim.get('auto_model', ''),
            'auto_year': claim.get('auto_year', 0),
            'userId': claim.get('userId', ''),
            'fraudScore': claim.get('fraudScore', 0),
            'riskLevel': claim.get('riskLevel', '')
        })
    
    def _create_relationships(self, users_data: List[Dict], policies_data: List[Dict], claims_data: List[Dict]):
        """Create relationships between nodes"""
        
        # User -> Policy relationships
        for policy in policies_data:
            query = """
            MATCH (u:User {userId: $userId})
            MATCH (p:Policy {policyId: $policyId})
            CREATE (u)-[:OWNS]->(p)
            """
            self.session.run(query, {
                'userId': policy.get('userId', ''),
                'policyId': policy.get('policyId', '')
            })
        
        # Policy -> Claim relationships
        for claim in claims_data:
            query = """
            MATCH (p:Policy {policyId: $policyId})
            MATCH (c:Claim {claimId: $claimId})
            CREATE (p)-[:HAS_CLAIM]->(c)
            """
            self.session.run(query, {
                'policyId': claim.get('policyId', ''),
                'claimId': claim.get('claimId', '')
            })
        
        # User -> Claim relationships
        for claim in claims_data:
            query = """
            MATCH (u:User {userId: $userId})
            MATCH (c:Claim {claimId: $claimId})
            CREATE (u)-[:FILED]->(c)
            """
            self.session.run(query, {
                'userId': claim.get('userId', ''),
                'claimId': claim.get('claimId', '')
            })
    
    def detect_fraud_rings(self) -> Dict[str, Any]:
        """Main fraud ring detection algorithm"""
        logger.info("Starting fraud ring detection...")
        
        results = {
            'suspicious_networks': [],
            'fraud_indicators': {},
            'risk_scores': {},
            'recommendations': []
        }
        
        # 1. Detect suspicious user networks
        results['suspicious_networks'] = self._detect_suspicious_networks()
        
        # 2. Analyze fraud indicators
        results['fraud_indicators'] = self._analyze_fraud_indicators()
        
        # 3. Calculate risk scores
        results['risk_scores'] = self._calculate_risk_scores()
        
        # 4. Generate recommendations
        results['recommendations'] = self._generate_recommendations(results)
        
        return results
    
    def _detect_suspicious_networks(self) -> List[Dict]:
        """Detect suspicious user networks using graph algorithms"""
        networks = []
        
        # 1. Same phone number networks
        phone_networks = self._detect_phone_networks()
        networks.extend(phone_networks)
        
        # 2. Policy pattern networks
        policy_networks = self._detect_policy_networks()
        networks.extend(policy_networks)
        
        # 3. Claim pattern networks
        claim_networks = self._detect_claim_networks()
        networks.extend(claim_networks)
        
        # Remove duplicates and return
        return self._remove_duplicate_networks(networks)
    
    def _detect_phone_networks(self) -> List[Dict]:
        """Detect users sharing phone numbers"""
        query = """
        MATCH (u1:User)-[:OWNS]->(p1:Policy)-[:HAS_CLAIM]->(c1:Claim)
        MATCH (u2:User)-[:OWNS]->(p2:Policy)-[:HAS_CLAIM]->(c2:Claim)
        WHERE u1.phone = u2.phone 
        AND u1.userId <> u2.userId
        AND u1.phone <> ''
        WITH u1, u2, collect(DISTINCT c1) as claims1, collect(DISTINCT c2) as claims2
        WHERE size(claims1) > 0 AND size(claims2) > 0
        RETURN u1.userId as user1, u1.displayName as name1, u1.email as email1,
               u2.userId as user2, u2.displayName as name2, u2.email as email2,
               u1.phone as phone,
               size(claims1) as claims_count1, size(claims2) as claims_count2,
               reduce(total1 = 0, claim in claims1 | total1 + claim.claimAmount) as total_amount1,
               reduce(total2 = 0, claim in claims2 | total2 + claim.claimAmount) as total_amount2
        """
        
        result = self.session.run(query)
        networks = []
        
        for record in result:
            networks.append({
                'type': 'phone_network',
                'users': [record['user1'], record['user2']],
                'user_names': [record['name1'] or 'Unknown', record['name2'] or 'Unknown'],
                'user_emails': [record['email1'] or 'No email', record['email2'] or 'No email'],
                'shared_attribute': record['phone'],
                'risk_score': self._calculate_network_risk_score(record),
                'details': {
                    'phone': record['phone'],
                    'claims_count1': record['claims_count1'],
                    'claims_count2': record['claims_count2'],
                    'total_amount1': record['total_amount1'],
                    'total_amount2': record['total_amount2']
                }
            })
        
        return networks
    
    def _remove_duplicate_networks(self, networks: List[Dict]) -> List[Dict]:
        """Remove duplicate networks based on user pairs"""
        seen = set()
        unique_networks = []
        
        for network in networks:
            # Create a unique key based on sorted user IDs
            user_key = tuple(sorted(network['users']))
            if user_key not in seen:
                seen.add(user_key)
                unique_networks.append(network)
        
        return unique_networks
    
    
    def _detect_policy_networks(self) -> List[Dict]:
        """Detect suspicious policy patterns"""
        query = """
        MATCH (u1:User)-[:OWNS]->(p1:Policy)
        MATCH (u2:User)-[:OWNS]->(p2:Policy)
        WHERE u1.userId <> u2.userId
        AND p1.insurance_type = p2.insurance_type
        AND p1.policy_annual_premium = p2.policy_annual_premium
        AND p1.sum_insured = p2.sum_insured
        AND p1.policy_annual_premium > 0
        WITH u1, u2, p1, p2
        MATCH (p1)-[:HAS_CLAIM]->(c1:Claim)
        MATCH (p2)-[:HAS_CLAIM]->(c2:Claim)
        WITH u1, u2, p1, p2, collect(DISTINCT c1) as claims1, collect(DISTINCT c2) as claims2
        WHERE size(claims1) > 0 AND size(claims2) > 0
        RETURN u1.userId as user1, u2.userId as user2,
               u1.name as name1, u2.name as name2,
               u1.email as email1, u2.email as email2,
               p1.policyId as policy1, p2.policyId as policy2,
               p1.insurance_type as insurance_type,
               p1.policy_annual_premium as premium,
               p1.sum_insured as sum_insured,
               size(claims1) as claims_count1, size(claims2) as claims_count2
        """
        
        result = self.session.run(query)
        networks = []
        
        for record in result:
            networks.append({
                'type': 'policy_network',
                'users': [record['user1'], record['user2']],
                'user_names': [record['name1'] or 'Unknown', record['name2'] or 'Unknown'],
                'user_emails': [record['email1'] or 'No email', record['email2'] or 'No email'],
                'shared_attribute': f"Same {record['insurance_type']} policy details",
                'risk_score': self._calculate_network_risk_score(record),
                'details': {
                    'policy1': record['policy1'],
                    'policy2': record['policy2'],
                    'insurance_type': record['insurance_type'],
                    'premium': record['premium'],
                    'sum_insured': record['sum_insured'],
                    'claims_count1': record['claims_count1'],
                    'claims_count2': record['claims_count2']
                }
            })
        
        return networks
    
    def _detect_claim_networks(self) -> List[Dict]:
        """Detect suspicious claim patterns"""
        query = """
        MATCH (u1:User)-[:FILED]->(c1:Claim)
        MATCH (u2:User)-[:FILED]->(c2:Claim)
        WHERE u1.userId <> u2.userId
        AND c1.claimType = c2.claimType
        AND c1.claimAmount = c2.claimAmount
        AND c1.incidentDate = c2.incidentDate
        AND c1.claimAmount > 0
        WITH u1, u2, c1, c2
        MATCH (c1)<-[:HAS_CLAIM]-(p1:Policy)
        MATCH (c2)<-[:HAS_CLAIM]-(p2:Policy)
        WHERE p1.insurance_type = p2.insurance_type
        RETURN u1.userId as user1, u2.userId as user2,
               u1.name as name1, u2.name as name2,
               u1.email as email1, u2.email as email2,
               c1.claimId as claim1, c2.claimId as claim2,
               c1.claimType as claim_type,
               c1.claimAmount as claim_amount,
               c1.incidentDate as incident_date,
               p1.insurance_type as insurance_type
        """
        
        result = self.session.run(query)
        networks = []
        
        for record in result:
            networks.append({
                'type': 'claim_network',
                'users': [record['user1'], record['user2']],
                'user_names': [record['name1'] or 'Unknown', record['name2'] or 'Unknown'],
                'user_emails': [record['email1'] or 'No email', record['email2'] or 'No email'],
                'shared_attribute': f"Identical {record['claim_type']} claim",
                'risk_score': 0.9,  # Very high risk for identical claims
                'details': {
                    'claim1': record['claim1'],
                    'claim2': record['claim2'],
                    'claim_type': record['claim_type'],
                    'claim_amount': record['claim_amount'],
                    'incident_date': record['incident_date'],
                    'insurance_type': record['insurance_type']
                }
            })
        
        return networks
    
    def _calculate_network_risk_score(self, record) -> float:
        """Calculate risk score for a network"""
        base_score = 0.3
        
        # Add risk based on number of claims
        claims_count = record.get('claims_count1', 0) + record.get('claims_count2', 0)
        if claims_count > 5:
            base_score += 0.3
        elif claims_count > 2:
            base_score += 0.2
        
        # Add risk based on claim amounts
        total_amount = record.get('total_amount1', 0) + record.get('total_amount2', 0)
        if total_amount > 1000000:  # 10 lakh
            base_score += 0.3
        elif total_amount > 500000:  # 5 lakh
            base_score += 0.2
        
        return min(base_score, 1.0)
    
    def _analyze_fraud_indicators(self) -> Dict[str, Any]:
        """Analyze various fraud indicators"""
        indicators = {
            'high_fraud_score_users': [],
            'rapid_claim_filers': [],
            'suspicious_amounts': [],
            'time_patterns': [],
            'document_patterns': []
        }
        
        # High fraud score users
        query = """
        MATCH (u:User)-[:FILED]->(c:Claim)
        WHERE c.fraudScore > 0.7
        WITH u, collect(c) as claims
        WHERE size(claims) > 0
        RETURN u.userId, u.email, u.phone, 
               size(claims) as claim_count,
               reduce(total = 0, claim in claims | total + claim.fraudScore) / size(claims) as avg_fraud_score,
               reduce(total = 0, claim in claims | total + claim.claimAmount) as total_amount
        ORDER BY avg_fraud_score DESC
        LIMIT 20
        """
        
        result = self.session.run(query)
        for record in result:
            indicators['high_fraud_score_users'].append({
                'userId': record['u.userId'],
                'email': record['u.email'],
                'phone': record['u.phone'],
                'claim_count': record['claim_count'],
                'avg_fraud_score': record['avg_fraud_score'],
                'total_amount': record['total_amount']
            })
        
        # Rapid claim filers (multiple claims in short time)
        # Try different date parsing approaches
        query = """
        MATCH (u:User)-[:FILED]->(c:Claim)
        WHERE c.submittedDate IS NOT NULL AND c.submittedDate <> ''
        WITH u, c, 
             CASE 
               WHEN c.submittedDate CONTAINS '-' THEN 
                 CASE 
                   WHEN c.submittedDate CONTAINS 'T' THEN datetime(c.submittedDate)
                   ELSE date(c.submittedDate)
                 END
               ELSE null
             END as parsed_date
        WHERE parsed_date IS NOT NULL
        WITH u, collect(c) as claims, collect(parsed_date) as dates
        WHERE size(claims) >= 2
        WITH u, claims, dates,
             reduce(max_date = head(dates), date in dates | 
               CASE WHEN date > max_date THEN date ELSE max_date END
             ) as latest_date,
             reduce(min_date = head(dates), date in dates | 
               CASE WHEN date < min_date THEN date ELSE min_date END
             ) as earliest_date
        WHERE duration.between(earliest_date, latest_date).days <= 30
        RETURN u.userId, u.email, u.phone,
               size(claims) as claim_count,
               reduce(total = 0, claim in claims | total + claim.claimAmount) as total_amount,
               latest_date, earliest_date
        ORDER BY claim_count DESC
        """
        
        result = self.session.run(query)
        rapid_filers_count = 0
        for record in result:
            rapid_filers_count += 1
            logger.info(f"Rapid filer: {record['u.email']} - {record['claim_count']} claims, date range: {record['earliest_date']} to {record['latest_date']}")
            indicators['rapid_claim_filers'].append({
                'userId': record['u.userId'],
                'email': record['u.email'],
                'phone': record['u.phone'],
                'claim_count': record['claim_count'],
                'total_amount': record['total_amount']
            })
        
        # Fallback: if no results with date filtering, try without date filtering
        if rapid_filers_count == 0:
            logger.info("No rapid filers found with date filtering, trying fallback approach...")
            fallback_query = """
            MATCH (u:User)-[:FILED]->(c:Claim)
            WITH u, collect(c) as claims
            WHERE size(claims) >= 2
            RETURN u.userId, u.email, u.phone,
                   size(claims) as claim_count,
                   reduce(total = 0, claim in claims | total + claim.claimAmount) as total_amount,
                   [claim in claims | claim.submittedDate] as filed_dates
            ORDER BY claim_count DESC
            LIMIT 10
            """
            
            fallback_result = self.session.run(fallback_query)
            for record in fallback_result:
                rapid_filers_count += 1
                logger.info(f"Fallback rapid filer: {record['u.email']} - {record['claim_count']} claims, dates: {record['filed_dates']}")
                indicators['rapid_claim_filers'].append({
                    'userId': record['u.userId'],
                    'email': record['u.email'],
                    'phone': record['u.phone'],
                    'claim_count': record['claim_count'],
                    'total_amount': record['total_amount']
                })
        
        logger.info(f"Found {rapid_filers_count} rapid claim filers")
        
        return indicators
    
    def _calculate_risk_scores(self) -> Dict[str, float]:
        """Calculate overall risk scores for users"""
        risk_scores = {}
        
        query = """
        MATCH (u:User)-[:FILED]->(c:Claim)
        WITH u, collect(c) as claims
        WHERE size(claims) > 0
        RETURN u.userId, u.displayName, u.email,
               size(claims) as claim_count,
               reduce(total = 0, claim in claims | total + claim.fraudScore) / size(claims) as avg_fraud_score,
               reduce(total = 0, claim in claims | total + claim.claimAmount) as total_amount,
               reduce(max_val = 0, claim in claims | CASE WHEN claim.claimAmount > max_val THEN claim.claimAmount ELSE max_val END) as max_claim_amount
        """
        
        result = self.session.run(query)
        for record in result:
            user_id = record['u.userId']
            
            # Calculate composite risk score
            claim_count_score = min(record['claim_count'] / 10, 1.0)  # Normalize to 0-1
            fraud_score = record['avg_fraud_score'] or 0
            amount_score = min(record['total_amount'] / 1000000, 1.0)  # Normalize to 0-1
            
            risk_scores[user_id] = {
                'overall_risk': (claim_count_score * 0.3 + fraud_score * 0.5 + amount_score * 0.2),
                'claim_count': record['claim_count'],
                'avg_fraud_score': fraud_score,
                'total_amount': record['total_amount'],
                'max_claim_amount': record['max_claim_amount'],
                'displayName': record['u.displayName'] or 'Unknown User',
                'email': record['u.email'] or 'No email'
            }
        
        return risk_scores
    
    def _generate_recommendations(self, results: Dict) -> List[str]:
        """Generate actionable recommendations"""
        recommendations = []
        
        # Network-based recommendations
        if results['suspicious_networks']:
            recommendations.append(f"🚨 {len(results['suspicious_networks'])} suspicious networks detected - investigate immediately")
        
        # High-risk users
        high_risk_users = [user for user, score in results['risk_scores'].items() 
                          if score['overall_risk'] > 0.7]
        if high_risk_users:
            recommendations.append(f"⚠️ {len(high_risk_users)} high-risk users identified - manual review required")
        
        # Rapid filers
        if results['fraud_indicators']['rapid_claim_filers']:
            recommendations.append(f"⚡ {len(results['fraud_indicators']['rapid_claim_filers'])} users filing claims rapidly - investigate patterns")
        
        return recommendations
    
    def get_network_visualization_data(self) -> Dict[str, Any]:
        """Get data for network visualization"""
        query = """
        MATCH (u:User)-[:FILED]->(c:Claim)
        WHERE c.fraudScore > 0.5
        RETURN u.userId, u.email, u.phone, c.claimId, c.claimAmount, c.fraudScore
        """
        
        result = self.session.run(query)
        nodes = []
        edges = []
        
        for record in result:
            nodes.append({
                'id': record['u.userId'],
                'label': record['u.email'],
                'type': 'user',
                'fraudScore': record['c.fraudScore'],
                'claimAmount': record['claimAmount']
            })
        
        return {
            'nodes': nodes,
            'edges': edges
        }

# Example usage
if __name__ == "__main__":
    # Initialize detector
    detector = FraudRingDetector(
        neo4j_uri="bolt://localhost:7687",
        username="neo4j",
        password="password"
    )
    
    # Create schema
    detector.create_schema()
    
    # Load data (you would get this from Firestore)
    users_data = []  # Load from Firestore
    policies_data = []  # Load from Firestore
    claims_data = []  # Load from Firestore
    
    # Load data into Neo4j
    detector.load_data_from_firestore(users_data, policies_data, claims_data)
    
    # Detect fraud rings
    results = detector.detect_fraud_rings()
    
    # Print results
    print(json.dumps(results, indent=2))
    
    # Close connection
    detector.close()
